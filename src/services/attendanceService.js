const Zkteco = require("zkteco-js");
const pool = require("../config/db");
const { TIME } = require("sequelize");
const xlsx = require('xlsx');
const fs = require('fs');
const e = require("express");
const moment = require('moment');

moment.locale('fr');


/**
 * Marque les pointages problématiques pour vérification humaine
 * param {number} employeeId - ID de l'employé concerné
 */
async function flagForManualReview(employeeId) {
    // 1. Marquer les enregistrements problématiques
    await pool.query(`
        UPDATE attendance_records
        SET needs_review = TRUE
        WHERE employee_id = $1 
        AND (
            (punch_type IS NULL)
            OR (id IN (
                SELECT current.id
                FROM attendance_records current
                JOIN attendance_records next ON (
                    next.employee_id = current.employee_id 
                    AND next.punch_time > current.punch_time
                    AND next.punch_time - current.punch_time < INTERVAL '15 minutes'
                )
                WHERE current.employee_id = $1
                AND current.punch_type = next.punch_type
            ))
        )`,
        [employeeId]
    );

    // 2. Notifier les RH - version corrigée
    const problematicCount = await pool.query(
        `SELECT COUNT(*)::integer as count FROM attendance_records 
         WHERE employee_id = $1 AND needs_review`,
        [employeeId]
    );

    if (problematicCount.rows[0].count > 0) {
        await pool.query(`
            INSERT INTO hr_notifications 
            (employee_id, notification_type, message)
            VALUES ($1, 'ATTENDANCE_REVIEW', $2)`,
            [employeeId, `${problematicCount.rows[0].count} pointages nécessitent une vérification`]
        );
    }
}

async function flagAsProcessingError(employeeId) {
    await pool.query(`
        INSERT INTO processing_errors 
        (employee_id, error_type, timestamp)
        VALUES ($1, 'AUTO_PUNCH_CLASSIFICATION', NOW())`,
        [employeeId]
    );
}
/* Fonction pour classer automatiquement tous les pointages
async function classifyAllPunchesWithLogs() {
    console.log('[Début] Reclassification de tous les pointages');

    try {
        // 1. Récupérer tous les pointages (même ceux avec punch_type déjà défini)
        console.time('Récupération des données');
        const punches = await pool.query(`
            SELECT id, employee_id, punch_time, punch_type
            FROM attendance_records
            ORDER BY employee_id, punch_time
        `);
        console.timeEnd('Récupération des données');
        console.log(`→ ${punches.rows.length} pointages récupérés`);

        if (punches.rows.length === 0) {
            console.log('[Fin] Aucun pointage à classifier');
            return;
        }

        // 2. Grouper les pointages par employé et par jour
        const employeesPunches = {};
        punches.rows.forEach(punch => {
            if (!employeesPunches[punch.employee_id]) {
                employeesPunches[punch.employee_id] = {};
            }

            const punchDate = new Date(punch.punch_time);
            const dayKey = `${punchDate.getFullYear()}-${punchDate.getMonth() + 1}-${punchDate.getDate()}`;

            if (!employeesPunches[punch.employee_id][dayKey]) {
                employeesPunches[punch.employee_id][dayKey] = [];
            }

            employeesPunches[punch.employee_id][dayKey].push(punch);
        });

        const employeeIds = Object.keys(employeesPunches);
        console.log(`→ ${employeeIds.length} employés concernés`);

        // 3. Traitement par employé/jour
        for (const employeeId of employeeIds) {
            const daysPunches = employeesPunches[employeeId];
            const dayKeys = Object.keys(daysPunches).sort();

            console.log(`\n=== Employé ${employeeId} (${dayKeys.length} jours) ===`);

            for (const dayKey of dayKeys) {
                const punchesOfDay = daysPunches[dayKey];
                punchesOfDay.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));

                console.log(`\n--- ${dayKey} (${punchesOfDay.length} pointages) ---`);

                let lastPunchType = null;
                let isNightShift = false;

                for (let i = 0; i < punchesOfDay.length; i++) {
                    const punch = punchesOfDay[i];
                    const punchTime = new Date(punch.punch_time);
                    const hours = punchTime.getHours();
                    const minutes = punchTime.getMinutes();
                    const timeStr = punchTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                    try {
                        console.log(`Pointage #${i + 1} à ${timeStr}`);

                        const isNightTime = hours >= 21 || hours < 6;
                        const isEarlyMorning = (hours === 5 && minutes > 50) || (hours === 6 && minutes <= 10);

                        // Premier pointage
                        if (i === 0) {
                            if (isEarlyMorning) {
                                punch.punch_type = 'OUT';
                                isNightShift = false;
                                console.log('→ Premier pointage matinal = OUT (fin de nuit)');
                            } else {
                                punch.punch_type = 'IN';
                                isNightShift = isNightTime;
                                console.log(isNightTime ? '→ Début: shift de nuit' : '→ Début: shift de jour');
                            }
                        }
                        // Pointages suivants
                        else {
                            const prevPunchTime = new Date(punchesOfDay[i - 1].punch_time);
                            const timeDiff = (punchTime - prevPunchTime) / (1000 * 60); // minutes

                            if (isEarlyMorning && isNightShift) {
                                punch.punch_type = 'OUT';
                                isNightShift = false;
                                console.log('→ OUT automatique (fin de nuit)');
                            } else if (hours >= 21 && !isNightShift && timeDiff > 60) {
                                punch.punch_type = 'IN';
                                isNightShift = true;
                                console.log('→ Début nouveau shift de nuit');
                            } else {
                                punch.punch_type = lastPunchType === 'IN' ? 'OUT' : 'IN';
                                console.log(`→ Alternance normale (dernier type: ${lastPunchType})`);
                            }
                        }

                        lastPunchType = punch.punch_type;

                        // Forcer la mise à jour même si punch_type était déjà défini
                        await pool.query(
                            `UPDATE attendance_records 
                             SET punch_type = $1, 
                                 needs_review = false 
                             WHERE id = $2`,
                            [punch.punch_type, punch.id]
                        );

                        console.log(`✓ punch_type mis à jour en ${punch.punch_type}`);

                    } catch (err) {
                        console.error(`❌ Erreur sur pointage ${punch.id}:`, err.message);
                        await pool.query(
                            `UPDATE attendance_records 
                             SET needs_review = true,
                                 review_reason = $1
                             WHERE id = $2`,
                            [`Erreur traitement: ${err.message.slice(0, 100)}`, punch.id]
                        );
                    }
                }
            }
        }

        console.log('\n[Fin] Reclassification terminée');
    } catch (error) {
        console.error('[ERREUR GLOBALE]', error.stack);
        throw error;
    }
}  */

async function classifyAllPunchesWithLogs() {
    console.log('[Début] Reclassification de tous les pointages');

    try {
        // 1. Récupérer tous les pointages (même ceux avec punch_type déjà défini)
        console.time('Récupération des données');
        const punches = await pool.query(`
            SELECT id, employee_id, punch_time, punch_type
            FROM attendance_records
            ORDER BY employee_id, punch_time
        `);
        console.timeEnd('Récupération des données');
        console.log(`→ ${punches.rows.length} pointages récupérés`);

        if (punches.rows.length === 0) {
            console.log('[Fin] Aucun pointage à classifier');
            return;
        }

        // 2. Grouper les pointages par employé et par jour
        const employeesPunches = {};
        punches.rows.forEach(punch => {
            if (!employeesPunches[punch.employee_id]) {
                employeesPunches[punch.employee_id] = {};
            }

            const punchDate = new Date(punch.punch_time);
            const dayKey = `${punchDate.getFullYear()}-${punchDate.getMonth() + 1}-${punchDate.getDate()}`;

            if (!employeesPunches[punch.employee_id][dayKey]) {
                employeesPunches[punch.employee_id][dayKey] = [];
            }

            employeesPunches[punch.employee_id][dayKey].push(punch);
        });

        const employeeIds = Object.keys(employeesPunches);
        console.log(`→ ${employeeIds.length} employés concernés`);

        // 3. Traitement par employé/jour
        for (const employeeId of employeeIds) {
            const daysPunches = employeesPunches[employeeId];
            const dayKeys = Object.keys(daysPunches).sort();

            console.log(`\n=== Employé ${employeeId} (${dayKeys.length} jours) ===`);

            for (let d = 0; d < dayKeys.length; d++) {
                const dayKey = dayKeys[d];
                const punchesOfDay = daysPunches[dayKey];
                punchesOfDay.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));

                console.log(`\n--- ${dayKey} (${punchesOfDay.length} pointages) ---`);

                let lastPunchType = null;
                let isNightShift = false;
                let previousDayHadNightEntry = false;

                // Vérifier s'il y a eu une entrée la veille entre 21h et 23h
                if (d > 0) {
                    const previousDayKey = dayKeys[d - 1];
                    const previousDayPunches = daysPunches[previousDayKey];
                    previousDayHadNightEntry = previousDayPunches.some(punch => {
                        const punchTime = new Date(punch.punch_time);
                        const hours = punchTime.getHours();
                        return punch.punch_type === 'IN' && hours >= 21 && hours < 23;
                    });
                    console.log(`→ Entrée entre 21h-23h la veille: ${previousDayHadNightEntry ? 'OUI' : 'NON'}`);
                }

                for (let i = 0; i < punchesOfDay.length; i++) {
                    const punch = punchesOfDay[i];
                    const punchTime = new Date(punch.punch_time);
                    const hours = punchTime.getHours();
                    const minutes = punchTime.getMinutes();
                    const timeStr = punchTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                    try {
                        console.log(`Pointage #${i + 1} à ${timeStr}`);

                        const isNightTime = hours >= 21 || hours < 6;
                        const isEarlyMorning = (hours === 5 && minutes > 10) || (hours === 6 && minutes <= 50);

                        // Premier pointage
                        if (i === 0) {
                            if (isEarlyMorning) {
                                // Si pas d'entrée la veille entre 21h-23h, c'est une entrée matinale
                                if (!previousDayHadNightEntry) {
                                    punch.punch_type = 'IN';
                                    isNightShift = false;
                                    console.log('→ Premier pointage matinal = IN (pas d\'entrée la veille 21h-23h)');
                                } else {
                                    punch.punch_type = 'OUT';
                                    isNightShift = false;
                                    console.log('→ Premier pointage matinal = OUT (fin de nuit)');
                                }
                            } else {
                                punch.punch_type = 'IN';
                                isNightShift = isNightTime;
                                console.log(isNightTime ? '→ Début: shift de nuit' : '→ Début: shift de jour');
                            }
                        }
                        // Pointages suivants
                        else {
                            const prevPunchTime = new Date(punchesOfDay[i - 1].punch_time);
                            const timeDiff = (punchTime - prevPunchTime) / (1000 * 60); // minutes

                            if (isEarlyMorning && isNightShift) {
                                punch.punch_type = 'OUT';
                                isNightShift = false;
                                console.log('→ OUT automatique (fin de nuit)');
                            } else if (hours >= 21 && !isNightShift && timeDiff > 60) {
                                punch.punch_type = 'IN';
                                isNightShift = true;
                                console.log('→ Début nouveau shift de nuit');
                            } else {
                                punch.punch_type = lastPunchType === 'IN' ? 'OUT' : 'IN';
                                console.log(`→ Alternance normale (dernier type: ${lastPunchType})`);
                            }
                        }

                        lastPunchType = punch.punch_type;

                        // Forcer la mise à jour même si punch_type était déjà défini
                        await pool.query(
                            `UPDATE attendance_records 
                             SET punch_type = $1, 
                                 needs_review = false 
                             WHERE id = $2`,
                            [punch.punch_type, punch.id]
                        );

                        console.log(`✓ punch_type mis à jour en ${punch.punch_type}`);

                    } catch (err) {
                        console.error(`❌ Erreur sur pointage ${punch.id}:`, err.message);
                        await pool.query(
                            `UPDATE attendance_records 
                             SET needs_review = true,
                                 review_reason = $1
                             WHERE id = $2`,
                            [`Erreur traitement: ${err.message.slice(0, 100)}`, punch.id]
                        );
                    }
                }
            }
        }

        console.log('\n[Fin] Reclassification terminée');
    } catch (error) {
        console.error('[ERREUR GLOBALE]', error.stack);
        throw error;
    }
}

async function checkFiveMonthsAnniversary() {
    try {
        const currentDate = new Date();
        const currentWeekStart = new Date(currentDate);
        currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);
        let enterprise = "STGI"   // nom de la société à mettre dans les variable global plutard !
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);

        // Query employees with upcoming 5-month anniversaries
        const result = await pool.query(`
            SELECT attendance_id, name, hire_date
            FROM employees 
            WHERE hire_date IS NOT NULL
            AND DATE(hire_date + INTERVAL '5 months') BETWEEN $1 AND $2
        `, [currentWeekStart, currentWeekEnd]);

        if (result.rows.length === 0) {
            console.log('✓ Aucun employé ne fête ses 5 mois cette semaine');
            return 0;
        }

        // Prepare notifications
        const notifications = result.rows.map(employee => ({
            employeeId: employee.attendance_id,
            type: '5_months_anniversary',
            message: `${employee.name} fête ses 5 mois à ${enterprise} cette semaine (recruté le ${new Date(employee.hire_date).toLocaleDateString('fr-FR')})`
        }));

        // Batch insert
        const values = notifications.flatMap(n => [n.employeeId, n.type, n.message]);
        const placeholders = notifications.map((_, i) => 
            `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}, NOW())`
        ).join(',');

        await pool.query(`
            INSERT INTO hr_notifications 
            (employee_id, notification_type, message, created_at)
            VALUES ${placeholders}
        `, values);

        console.log(`✓ ${notifications.length} notifications créées pour les 5 mois d'ancienneté`);
        return notifications.length;

    } catch (error) {
        console.error('Erreur lors de la création des notifications:', error);
        throw error;
    }
}


// Fonction pour vérifier la classification des pointages et de detecter les pointages manquant afin de creer une notification pour informer le service rh
async function verifyAndFixPunchSequence() {
    console.log('[Début] Vérification et correction des séquences de pointages (6h-22h)');
    
    try {
        // 1. Récupération des données avec jointure pour avoir les noms
        console.time('Récupération des données');
        const { rows: punches } = await pool.query(`
            SELECT ar.id, ar.employee_id, e.name as employee_name, 
                   ar.punch_time, ar.punch_type, ar.punch_source
            FROM attendance_records ar
            LEFT JOIN employees e ON ar.employee_id = e.attendance_id
            WHERE ar.punch_type IS NOT NULL
            ORDER BY ar.employee_id, ar.punch_time`
        );
        console.timeEnd('Récupération des données');
        console.log(`→ ${punches.length} pointages à vérifier`);

        if (punches.length === 0) {
            console.log('[Fin] Aucun pointage à vérifier');
            return;
        }

        // 2. Structuration des données par employé et par jour
        const employeesPunches = {};
        punches.forEach(punch => {
            if (!employeesPunches[punch.employee_id]) {
                employeesPunches[punch.employee_id] = {
                    name: punch.employee_name,
                    days: {}
                };
            }
            
            const punchDate = new Date(punch.punch_time);
            const dayKey = punchDate.toISOString().split('T')[0];
            
            if (!employeesPunches[punch.employee_id].days[dayKey]) {
                employeesPunches[punch.employee_id].days[dayKey] = [];
            }
            
            employeesPunches[punch.employee_id].days[dayKey].push(punch);
        });
        
        const employeeIds = Object.keys(employeesPunches);
        console.log(`→ ${employeeIds.length} employés concernés`);

        // 3. Traitement par employé et par jour
        const allCorrections = [];
        const allNotifications = [];
        const allReviews = [];

        for (const employeeId of employeeIds) {
            const employeeData = employeesPunches[employeeId];
            const employeeDays = employeeData.days;
            const employeeName = employeeData.name || 'Nom inconnu';
            
            console.log(`\n--- Vérification ${employeeName} (${employeeId}) - ${Object.keys(employeeDays).length} jours ---`);
            
            let totalIssues = 0;

            for (const dayKey in employeeDays) {
                const dayPunches = employeeDays[dayKey];
                console.log(`\nJour ${dayKey} (${dayPunches.length} pointages):`);
                
                // Filtrage avec marge (6h-22h)
                const dayShiftPunches = dayPunches.filter(punch => {
                    const punchTime = new Date(punch.punch_time);
                    const totalMinutes = punchTime.getHours() * 60 + punchTime.getMinutes();
                    return totalMinutes >= 360 && totalMinutes <= 1320; // 6h=360min, 22h=1320min
                });
                
                if (dayShiftPunches.length === 0) {
                    console.log('→ Aucun pointage dans la plage 6h-22h');
                    continue;
                }
                
                console.log(`→ ${dayShiftPunches.length} pointages à vérifier (6h-22h)`);

                // Vérification pointages impairs
                const today = new Date().toISOString().split('T')[0];
                if (dayShiftPunches.length % 2 !== 0 && dayKey !== today) {
                    allNotifications.push({
                        employeeId,
                        type: 'POINTAGE_IMPAIR',
                        message: `Nombre impair de pointages (${dayShiftPunches.length}) pour ${employeeName} (${employeeId}) le ${dayKey}`
                    });
                    console.log(`❌ Nombre impair de pointages (${dayShiftPunches.length})`);
                    totalIssues++;
                }

                let expectedNextType = null;
                let dayIssues = 0;

                for (let i = 0; i < dayShiftPunches.length; i++) {
                    const punch = dayShiftPunches[i];
                    const punchTime = new Date(punch.punch_time);
                    const timeStr = punchTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
                    
                    try {
                        console.log(`  #${i+1} ${timeStr} [${punch.punch_type}]`);

                        // Détection OUT matinal suspect (avant 12h sans IN préalable)
                        if (punch.punch_type === 'OUT' && punchTime.getHours() < 12) {
                            const isFirstPunch = i === 0;
                            const hasNoPreviousIN = i > 0 && dayShiftPunches[i-1].punch_type !== 'IN';
                            
                            if (isFirstPunch || hasNoPreviousIN) {
                                const errorMsg = `OUT matinal suspect à ${timeStr} sans IN préalable`;
                                
                                // Correction automatique conditionnelle
                                if (isFirstPunch && punch.punch_source === 'AUTO') {
                                    console.log('  → Correction automatique: conversion en IN');
                                    allCorrections.push({
                                        id: punch.id,
                                        newType: 'IN',
                                        newSource: 'AUTO_CORRECTED'
                                    });
                                    allNotifications.push({
                                        employeeId,
                                        type: 'CORRECTION_AUTO',
                                        message: `OUT matinal converti en IN pour ${employeeName} (${employeeId}) le ${dayKey} à ${timeStr}`
                                    });
                                    expectedNextType = 'OUT';
                                    continue;
                                } else {
                                    allReviews.push({
                                        id: punch.id,
                                        reason: errorMsg
                                    });
                                    allNotifications.push({
                                        employeeId,
                                        type: 'POINTAGE_SUSPECT',
                                        message: `${errorMsg} pour ${employeeName} (${employeeId}) le ${dayKey}`
                                    });
                                    dayIssues++;
                                }
                            }
                        }

                        // Vérification séquence IN/OUT
                        if (i === 0 && punch.punch_type !== 'IN') {
                            console.log(`  ❌ Premier pointage devrait être IN (${punch.punch_type})`);
                            allReviews.push({
                                id: punch.id,
                                reason: 'Premier pointage devrait être IN'
                            });
                            dayIssues++;
                            expectedNextType = 'OUT';
                            continue;
                        }

                        if (expectedNextType && punch.punch_type !== expectedNextType) {
                            console.log(`  ❌ Séquence incorrecte: attendu ${expectedNextType}, trouvé ${punch.punch_type}`);
                            
                            // Correction automatique si inversion simple détectée
                            if (i < dayShiftPunches.length - 1 && 
                                dayShiftPunches[i+1].punch_type === expectedNextType &&
                                punch.punch_source === 'AUTO') {
                                console.log('  → Correction automatique: inversion détectée');
                                allCorrections.push({
                                    id: punch.id,
                                    newType: expectedNextType,
                                    newSource: 'AUTO_CORRECTED'
                                });
                            } else {
                                allReviews.push({
                                    id: punch.id,
                                    reason: `Séquence incorrecte: attendu ${expectedNextType} après ${dayShiftPunches[i-1].punch_type}`
                                });
                            }
                            dayIssues++;
                        }
                        
                        expectedNextType = punch.punch_type === 'IN' ? 'OUT' : 'IN';

                        // Vérification intervalle temporel
                        if (i > 0) {
                            const prevPunch = dayShiftPunches[i-1];
                            const prevTime = new Date(prevPunch.punch_time);
                            const timeDiff = (punchTime - prevTime) / (1000 * 60); // minutes
                            
                            // Intervalle trop court (<2 min)
                            if (timeDiff < 2) {
                                console.log(`  ⚠ Intervalle très court: ${timeDiff.toFixed(1)} minutes`);
                                allReviews.push({
                                    id: punch.id,
                                    reason: `Intervalle très court (${timeDiff.toFixed(1)} min)`
                                });
                                dayIssues++;
                            }
                            
                            // Pause longue (>15h entre OUT et IN suivant)
                            if (prevPunch.punch_type === 'OUT' && punch.punch_type === 'IN' && timeDiff > 60 * 15) {
                                console.log(`  ⚠ Pause longue: ${(timeDiff/60).toFixed(1)} heures`);
                                allNotifications.push({
                                    employeeId,
                                    type: 'PAUSE_LONGUE',
                                    message: `Pause longue de ${(timeDiff/60).toFixed(1)}h pour ${employeeName} (${employeeId}) le ${dayKey}`
                                });
                            }
                        }
                        
                    } catch (err) {
                        console.error(`  ❌ Erreur traitement:`, err.message);
                        allReviews.push({
                            id: punch.id,
                            reason: `Erreur traitement: ${err.message.slice(0, 100)}`
                        });
                        dayIssues++;
                    }
                }
                
                if (dayIssues > 0) {
                    console.log(`  → ${dayIssues} problèmes détectés`);
                    totalIssues += dayIssues;
                } else {
                    console.log('  ✓ Aucune incohérence détectée');
                }
            }
            
            console.log(`\n→ Total problèmes: ${totalIssues} pour ${employeeName} (${employeeId})`);
        }
        
        // 4. Exécution groupée des mises à jour
        console.time('Mises à jour en base');
        
        // Corrections automatiques
        if (allCorrections.length > 0) {
            await pool.query(`
                UPDATE attendance_records ar
                SET punch_type = c.newType,
                    punch_source = c.newSource
                FROM (VALUES ${allCorrections.map((c, i) => 
                    `($${i*3+1}, $${i*3+2}, $${i*3+3})`
                ).join(',')}) AS c(id, newType, newSource)
                WHERE ar.id = c.id::integer`,
                allCorrections.flatMap(c => [c.id, c.newType, c.newSource])
            );
            console.log(`✓ ${allCorrections.length} corrections appliquées`);
        }
        
        // Marquages pour revue
        if (allReviews.length > 0) {
            await pool.query(`
                UPDATE attendance_records ar
                SET needs_review = TRUE,
                    review_reason = r.reason
                FROM (VALUES ${allReviews.map((r, i) => 
                    `($${i*2+1}, $${i*2+2})`
                ).join(',')}) AS r(id, reason)
                WHERE ar.id = r.id::integer`,
                allReviews.flatMap(r => [r.id, r.reason])
            );
            console.log(`✓ ${allReviews.length} pointages marqués pour revue`);
        }
        
        // Notifications RH
        if (allNotifications.length > 0) {
            await pool.query(`
                INSERT INTO hr_notifications 
                (employee_id, notification_type, message, created_at)
                VALUES ${allNotifications.map((_, i) => 
                    `($${i*3+1}, $${i*3+2}, $${i*3+3}, NOW())`
                ).join(',')}`,
                allNotifications.flatMap(n => [n.employeeId, n.type, n.message])
            );
            console.log(`✓ ${allNotifications.length} notifications créées`);
        }
        
        console.timeEnd('Mises à jour en base');
        console.log('\n[Fin] Vérification et correction terminées');
    } catch (error) {
        console.error('[ERREUR GLOBALE]', error.stack);
        throw error;
    }
}

// fonction helper pour detecter la date d'ajourd'hui
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
  

// Création de Attendance_summary OK en detectant si c la date d'ajourd'hui ou non 
async function initAttendanceSummary(employeeId, date) {
    if (!Number.isInteger(Number(employeeId)) || isNaN(new Date(date).getTime())) {
        throw new Error(`Paramètres invalides: employeeId=${employeeId}, date=${date}`);
    }

    const client = await pool.connect();
    try {
        console.log(`🟢 Initialisation de l'attendance_summary pour employé ${employeeId} à la date ${date}`);

        // Vérifier si une entrée existe déjà
        const existingEntry = await client.query(
            `SELECT 1 FROM attendance_summary WHERE employee_id = $1 AND date = $2`,
            [employeeId, date]
        );

        if (existingEntry.rowCount === 0) {
            // Insérer une nouvelle ligne avec les valeurs par défaut
            await client.query(`
                INSERT INTO attendance_summary (
                    employee_id, date, is_weekend, is_saturday, is_sunday, created_at, updated_at, status
                ) VALUES (
                    $1, 
                    $2, 
                    EXTRACT(DOW FROM $2::DATE) IN (0, 6), 
                    EXTRACT(DOW FROM $2::DATE) = 6, 
                    EXTRACT(DOW FROM $2::DATE) = 0, 
                    NOW(), 
                    NOW(),
                    'absent'
                );
            `, [employeeId, date]);
            
            console.log(`✅ Nouvelle entrée ajoutée pour ${employeeId} à la date ${date}`);
        } else {
            console.log(`ℹ️ Une entrée existe déjà pour ${employeeId} à la date ${date}, aucune action nécessaire.`);
        }
    } catch (error) {
        console.error(`❌ Erreur lors de l'initialisation:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Gestion des jours fériés 
async function employeeHoliday(date, employeeId) {
    if (!Number.isInteger(Number(employeeId)) || isNaN(new Date(date).getTime())) {
        throw new Error(`Paramètres invalides: employeeId=${employeeId}, date=${date}`);
    }

    const client = await pool.connect();

    let is_holiday = false;
    let is_present_previous = false;
    let is_present_next = false;

    try {
        console.log(`📅 Check Jour férié pour l'employé ${employeeId} à la date ${date}`);

        // verifier si ce jour est un jour férié
        const holidayQuery = `
            SELECT holiday_date, previous_working_day, next_working_day 
            FROM public_holidays
            WHERE holiday_date = $1
        `;
        const holidayResult = await client.query(holidayQuery, [date]);

        if (holidayResult.rowCount > 0) {
            is_holiday = true;
            console.log(`🚫 Jour férié pour ${employeeId} à la date ${date}`);

            // verifier si le previous_working_day l'employé a travaillé
            const previousDate = holidayResult.rows[0].previous_working_day;
            const nextDate = holidayResult.rows[0].next_working_day;
            
            const previousWorkQuery = `
                SELECT 1 FROM attendance_summary
                WHERE employee_id = $1
                AND date = $2
                AND get_holiday = TRUE 
            `;
            const previousWorkResult = await client.query(previousWorkQuery, [employeeId, previousDate]);

            if (previousWorkResult.rowCount > 0) {
                console.log(`✅ L'employé ${employeeId} a travaillé le jour précédent (${previousDate})`);
                is_present_previous = true;
            }
            
            const nextWorkQuery = ` 
                SELECT 1 FROM attendance_summary
                WHERE employee_id = $1
                AND date = $2
                AND get_holiday = TRUE
            `;
            const nextWorkResult = await client.query(nextWorkQuery, [employeeId, nextDate]);
            
            if (nextWorkResult.rowCount > 0) {
                console.log(`✅ L'employé ${employeeId} a travaillé le jour suivant (${nextDate})`);
                is_present_next = true;
            }

            if (is_present_previous && is_present_next) {
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        penalisable = 0,
                        missed_hour = 0,
                        status = 'jf_win',
                        isholidays = TRUE,
                        get_holiday = TRUE,
                        worked_hours_on_holidays = hours_worked,
                        jf_value = 1       
                    WHERE employee_id = $1 AND date = $2;
                `, [employeeId, date]);
            } else if (is_holiday) {
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        penalisable = 0,
                        missed_hour = 0,
                        status = 'jf_lose',
                        get_holiday = TRUE,
                        worked_hours_on_holidays = hours_worked,
                        isholidays = TRUE     
                    WHERE employee_id = $1 AND date = $2;
                `, [employeeId, date]);
            }
        } else {
            console.log(`ℹ️ Aucun jour férié trouvé pour ${employeeId} à la date ${date}`);
        }

    } catch (error) {
        console.error(`❌ Erreur lors du traitement du check du jour férié:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Gestion des Indisponibilités (layoff)
async function employeeUnvailable(date, employeeId, employee_innerID) {
    if (!Number.isInteger(Number(employeeId)) || isNaN(new Date(date).getTime())) {
        throw new Error(`Paramètres invalides: employeeId=${employeeId}, date=${date}`);
    }

    const client = await pool.connect();


    try {
        console.log(`🚫 Check Indisponibilité pour l'empmloyé ${employeeId} à la date ${date}`);

        // verifier si ce jour est un layoff
        const layoffQuery = `
            SELECT start_date, end_date, type
            FROM layoff
            WHERE start_date <= $1 AND end_date >= $1 AND (type <> 'blame' AND type <> 'avertissement') AND employee_id = $2
        `;
        const layoffResult = await client.query(layoffQuery, [date, employee_innerID]);


        if (layoffResult.rowCount > 0) {

            const layof_type = layoffResult.rows[0].type;

            console.log(`🚫 Indisponibilité pour ${employeeId} à la date ${date}`);

            // For each case getin_ref MUST BE PRESENT otherwise it's dayoff
            if (layof_type === 'conge') {  // pour les congès simples
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        status = 'conge',
                        is_conge = TRUE,
                        get_holiday = TRUE,
                        nbr_absence = 1,
                        jc_value = 1       
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL;
                `, [employeeId, date]);
            } else if (layof_type === 'map') {  // pour les mis à pieds
                await client.query(`
                    UPDATE attendance_summary
                    SET
                        status = 'map',
                        nbr_absence = 1,
                        islayoff = TRUE  
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL;
                `, [employeeId, date]);
            } else if (layof_type === 'accident') { // pour accident de travail
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        status = 'accident',
                        nbr_absence = 1,
                        is_accident = TRUE     
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL; 
                `, [employeeId, date]); 

            } else if (layof_type === 'cg_maladie') { // pour congé maladie
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        status = 'cg_maladie',
                        nbr_absence = 1,
                        is_maladie = TRUE  
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL;
                `, [employeeId, date]);
            }
            else if (layof_type === 'rdv_medical') { // pour rdv médical, seul effet ( ne perd pas le droit de jour férié )
                await client.query(`
                    UPDATE attendance_summary
                    SET                   
                        status = 'rdv_medical',
                        nbr_absence = 1,
                        get_holiday = TRUE      
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL;
                `, [employeeId, date]);
            }
            else if (layof_type === 'mission') { // pour les missions, seul effet ( ne perd pas le droit de jour férié )
                await client.query(`
                    UPDATE attendance_summary
                    SET                   
                        status = 'mission',
                        nbr_absence = 0,
                        missed_hour = 0,
                        penalisable = 0,
                        hours_ worked = normal_hours,
                        hrs_norm_trav = normal_hours,
                        get_holiday = TRUE,
                        do_not_touch = TRUE,
                    WHERE employee_id = $1 AND date = $2;
                `, [employeeId, date]);    
            }
            else if (layof_type === 'remote') { // pour les Télétravail, seul effet ( ne perd pas le droit de jour férié )
                await client.query(`
                    UPDATE attendance_summary
                    SET                   
                        status = 'remote',
                        nbr_absence = 0,
                        missed_hour = 0,
                        penalisable = 0,
                        hours_worked = normal_hours,
                        hrs_norm_trav = normal_hours,
                        get_holiday = TRUE,
                        do_not_touch = TRUE   
                    WHERE employee_id = $1 AND date = $2;
                `, [employeeId, date]);       

            }
            else if (layof_type === 'repos') { // pour les Repos ( Pas d'absence )
                await client.query(`
                    UPDATE attendance_summary
                    SET                   
                        status = 'repos',
                        nbr_absence = 0,
                        missed_hour = 0,
                        penalisable = 0,
                        hours_worked = 0,
                        hrs_norm_trav = 0,
                        get_holiday = TRUE,
                        do_not_touch = TRUE   
                    WHERE employee_id = $1 AND date = $2;
                `, [employeeId, date]);       

            } else { // pour les congés exeptionnels 
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        status = 'cg_exp',
                        nbr_absence = 1,
                        get_holiday = TRUE,
                        is_congex = TRUE,
                        jcx_value = 1       
                    WHERE employee_id = $1 AND date = $2 AND getin_ref IS NOT NULL;
                `, [employeeId, date]);
            } 
        } else {
            console.log(`ℹ️ Aucun Layoff trouvé pour ${employeeId} à la date ${date}`);
        }

    } catch (error) {
        console.error(`❌ Erreur lors du traitement du check du Layoff:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Mettre à jour attendance_summary selon le shift de l'employé OK
async function employeeWorkShift(date, employeeId, employee_innerID) {
    if (!Number.isInteger(Number(employeeId)) || isNaN(new Date(date).getTime())) {
        throw new Error(`Paramètres invalides: employeeId=${employeeId}, date=${date}`);
    }

    const client = await pool.connect();

    try {
        console.log(`📅 Traitement du shift pour employé ${employeeId} à la date ${date}`);

        const shiftQuery = `
        SELECT ews.work_shift_id, ws.*
        FROM employee_work_shifts ews
        JOIN work_shifts ws ON ews.work_shift_id = ws.id
        WHERE ews.employee_id = $1 
        AND ews.start_date <= $2 
        AND (ews.end_date IS NULL OR ews.end_date >= $2)
        ORDER BY ews.id DESC
        LIMIT 1;
    `;
        
        const result = await client.query(shiftQuery, [employee_innerID, date]);
        if (result.rowCount === 0) {
            console.log(`❌ Aucun shift trouvé pour ${employeeId} à la date ${date}`);
            return;
        }
        
        const shift = result.rows[0];
        const dayOfWeek = new Date(date).toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        
        if (shift[`${dayOfWeek}_off`]) {
            console.log(`🚫 Jour de repos pour ${employeeId} à la date ${date}`);
            return;
        }
        
        const is_dayoff = shift[`${dayOfWeek}_off`]
        const startTime = shift[`${dayOfWeek}_start`];
        const endTime = shift[`${dayOfWeek}_end`];
        const breakMinutes = shift[`${dayOfWeek}_break`] || 0;
        const break_duration = breakMinutes / 60;
        let workDuration = 0;
        const is_today = isToday(new Date(date));

        if (!is_dayoff) {
             workDuration = ((new Date(`1970-01-01T${endTime}`) - new Date(`1970-01-01T${startTime}`)) / 3600000) - (breakMinutes / 60);
        }
      
        await client.query(`
            UPDATE attendance_summary
            SET 
                penalisable = $3,
                missed_hour = $3,
                normal_hours = $3,
                nbr_absence = 1,
                getin_ref = $4,
                break_duration = $5,
                getout_ref = $6
            WHERE employee_id = $1 AND date = $2 AND isholidays = FALSE AND is_conge = FALSE AND islayoff = FALSE AND do_not_touch is NULL AND status NOT IN ('mission', 'remote', 'repos');
        `, [employeeId, date, workDuration, startTime, break_duration, endTime]);
        
        console.log(`✅ Shift mis à jour pour ${employeeId} à la date ${date}`);
    } catch (error) {
        console.error(`❌ Erreur lors du traitement du shift:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}
// Fonction pour traiter les shifts de nuit ok
async function processNightShifts(employeeId) {
    // Validation de l'input
    if (!Number.isSafeInteger(parseInt(employeeId, 10))) {
        throw new Error(`ID employé invalide: ${employeeId}`);
    }
    const client = await pool.connect();
    try {
        console.log(`🌙 Traitement des shifts de nuit pour l'employé ${employeeId}`);

        // Récupération des paires IN/OUT optimisée pour les shifts de nuit
        const nightShiftsQuery = `
            WITH punches AS (
                SELECT 
                    id, 
                    employee_id, 
                    punch_time, 
                    punch_type,
                    DATE(punch_time) AS punch_date,
                    EXTRACT(HOUR FROM punch_time) + EXTRACT(MINUTE FROM punch_time) / 60 AS punch_hour
                FROM attendance_records
                WHERE employee_id = $1
                ORDER BY punch_time
            ),
            night_pairs AS (
                SELECT 
                    p1.id AS in_id,
                    p2.id AS out_id,
                    p1.punch_time AS in_time,
                    p2.punch_time AS out_time,
                    DATE(p1.punch_time) AS shift_date,
                    (EXTRACT(EPOCH FROM (p2.punch_time - p1.punch_time)) / 3600) AS night_hours
                FROM punches p1
                JOIN punches p2 ON p2.id = (
                    SELECT MIN(p3.id)
                    FROM punches p3
                    WHERE p3.punch_time > p1.punch_time
                    AND p3.punch_type = 'OUT'
                )
                WHERE p1.punch_type = 'IN'
                AND p1.punch_hour >= 21.5 AND p1.punch_hour < 24
                AND p2.punch_hour >= 5 AND p2.punch_hour <= 7
            )
            SELECT 
                in_id,
                out_id,
                in_time,
                out_time,
                shift_date,
                night_hours
            FROM night_pairs
            WHERE night_hours > 0
            ORDER BY shift_date;
        `;



        const nightShifts = await client.query(nightShiftsQuery, [employeeId]);
        console.log(`🔍 ${nightShifts.rows.length} shifts de nuit trouvés`);

        // Mise à jour des summaries existants
        for (const shift of nightShifts.rows) {
            const nightHours = parseFloat(shift.night_hours) || 0;
            if (nightHours > 24) {
                console.warn(`⚠️ Heures de nuit anormales (${nightHours}h) pour employé ${employeeId} le ${shift.shift_date}`);
                continue;
            }

            const durationSec = Math.floor((new Date(shift.out_time) - new Date(shift.in_time)) / 1000);
            const in_time_night = new Date(shift.in_time).toTimeString().slice(0, 5);
            const out_time_night = new Date(shift.out_time).toTimeString().slice(0, 5);

            try {
                await client.query(`
                    UPDATE attendance_summary
                    SET night_getin = $3, night_getout = $4,
                        has_night_shift = $5, night_hours = $6, 
                        night_worked = ($7::text || ' seconds')::interval,
                        status = 'night-shift',
                        get_holiday = TRUE,
                        penalisable = GREATEST(penalisable - $6, 0),
                        updated_at = NOW()
                    WHERE employee_id = $1 
                      AND date = $2 
                      AND isholidays = FALSE 
                      AND is_conge = FALSE 
                      AND islayoff = FALSE;
                `, [employeeId, shift.shift_date, in_time_night, out_time_night, nightHours > 0, nightHours, durationSec.toString()]);

                console.log(`📅 ${shift.shift_date}: ${nightHours.toFixed(2)}h (${shift.in_time} → ${shift.out_time})`);
            } catch (dbError) {
                console.error(`❌ Erreur DB pour ${employeeId} (${shift.shift_date}):`, dbError);
                throw dbError;
            }
        }

        console.log(`✅ Traitement des shifts de nuit terminé pour employé ${employeeId}`);
    } catch (error) {
        console.error(`❌ Erreur majeure pour employé ${employeeId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour traiter les pointage pour la date d'aujourd'hui OK
async function forToday(employeeId, date) {
    // Constants for business rules
    const REGULAR_SHIFT_START_MINUTES = 1 * 60 ; // 1:00 AM (01:00)
    const REGULAR_SHIFT_END_MINUTES = 20 * 60 + 59;   // 8:59 PM (20:59)
    const MIN_WORK_HOURS = 0; // Minimum worked hours can't be negative
    const HOURS_PRECISION = 2; // Decimal places for hours calculations


    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
      };
      

     // Calcul des dates : la veille, le jour même, le lendemain
     const targetDate = new Date(date);
     const startDate = new Date(targetDate);
     const endDate = new Date(targetDate);
     startDate.setDate(targetDate.getDate());
     endDate.setDate(targetDate.getDate());


    if (!Number.isInteger(Number(employeeId))) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }

    const client = await pool.connect();
    try {
        console.log(`🌞 Processing regular shifts for employee ${employeeId}`);

        // 1. Fetch all regular shifts (IN-OUT pairs)
        const regularShiftsQuery = `
        WITH ordered_punches AS (
            SELECT 
                id, 
                employee_id, 
                punch_time, 
                punch_type,
                DATE(punch_time) AS punch_date,
                LAG(id) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS prev_id,
                LAG(punch_time) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS prev_time,
                LAG(punch_type) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS prev_type,
                LEAD(id) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS next_id,
                LEAD(punch_time) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS next_time,
                LEAD(punch_type) OVER (PARTITION BY employee_id, DATE(punch_time) ORDER BY punch_time) AS next_type,
                EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) AS minutes_in_day
            FROM attendance_records
            WHERE employee_id = $1
              AND DATE(punch_time) BETWEEN $4::date AND $5::date
              AND (EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) 
                   BETWEEN $2 AND $3)
        ),
        paired_punches AS (
            -- Cas normal: IN suivi de OUT dans la plage horaire
            SELECT 
                prev_id AS in_id, 
                id AS out_id, 
                prev_time AS getin_time, 
                punch_time AS getout_time,
                punch_date AS shift_date,
                EXTRACT(EPOCH FROM (punch_time - prev_time)) / 3600 AS raw_worked_hours,
                'paired' AS punch_status
            FROM ordered_punches
            WHERE punch_type = 'OUT' 
              AND prev_type = 'IN'
              AND prev_time IS NOT NULL
        
            UNION ALL
        
            -- Cas punch IN isolé (pas suivi  OUT correct)
            SELECT 
                id AS in_id, 
                NULL AS out_id, 
                punch_time AS getin_time, 
                NULL AS getout_time,
                punch_date AS shift_date,
                0 AS raw_worked_hours,
                'in_only' AS punch_status
            FROM ordered_punches op
            WHERE punch_type = 'IN'
              AND (
                  next_type IS NULL 
                  OR next_type = 'IN' 
                  OR DATE(next_time) > punch_date
                  OR (next_type = 'OUT' AND NOT EXISTS (
                      SELECT 1 FROM ordered_punches op2 
                      WHERE op2.id = op.next_id AND op2.prev_id = op.id
                  ))
              )
        
            UNION ALL
        
            -- Cas punch OUT isolé (pas précédé IN correct)
            SELECT 
                NULL AS in_id, 
                id AS out_id, 
                NULL AS getin_time, 
                punch_time AS getout_time,
                punch_date AS shift_date,
                0 AS raw_worked_hours,
                'out_only' AS punch_status
            FROM ordered_punches op
            WHERE punch_type = 'OUT'
              AND (
                  prev_type IS NULL 
                  OR prev_type = 'OUT'
                  OR (prev_type = 'IN' AND NOT EXISTS (
                      SELECT 1 FROM ordered_punches op2 
                      WHERE op2.id = op.id AND op2.prev_type = 'IN' AND op2.prev_id IS NOT NULL
                  ))
              )
        )
        SELECT * FROM paired_punches
        ORDER BY shift_date, COALESCE(getin_time, getout_time)
        `;

        
        const shifts = await client.query(regularShiftsQuery, [
            employeeId,                         // $1
            REGULAR_SHIFT_START_MINUTES,       // $2
            REGULAR_SHIFT_END_MINUTES,         // $3
            startDate,                         // $4
            endDate                            // $5
        ]);
        

        // 2. Process each shift
        for (const shift of shifts.rows) {
            try {
                // Format times safely
                const formatTime = (dateTime) => {
                    if (!dateTime || isNaN(new Date(dateTime).getTime())) return null;
                    const d = new Date(dateTime);
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                };
                

                const isValidTime = (time) => time && !isNaN(new Date(time).getTime());

                const getin = isValidTime(shift.getin_time) ? formatTime(shift.getin_time) : null;
                const getout = isValidTime(shift.getout_time) ? formatTime(shift.getout_time) : null;
                let workedHours = parseFloat(shift.raw_worked_hours) || 0;

                const is_today = isToday(new Date(shift.shift_date));
            

                // 3. Get shift summary data
                const summaryQuery = `
                    SELECT 
                        getin_ref, 
                        getout_ref,
                        break_duration
                    FROM attendance_summary
                    WHERE employee_id = $1 
                      AND date = $2
                      AND isholidays = FALSE 
                      AND is_conge = FALSE 
                      AND islayoff = FALSE
                    LIMIT 1;
                `;
                const summaryResult = await client.query(summaryQuery, [employeeId, shift.shift_date]);
                
                if (summaryResult.rows.length === 0) continue;
                
                const summary = summaryResult.rows[0];
                const getin_ref = isValidTime(summary.getin_ref) ? formatTime(summary.getin_ref) : null;
                const getout_ref = isValidTime(summary.getout_ref) ? formatTime(summary.getout_ref) : null;
                const breakDuration = parseFloat(summary.break_duration) || 0;

                // 4. Calculate authorization periods
                const authorizationQuery = `
                    SELECT 
                        MIN(CAST(punch_time AS TIME)) AS autoriz_getin_time, 
                        MAX(CAST(punch_time AS TIME)) AS autoriz_getout_time
                    FROM attendance_records
                    WHERE employee_id = $1 
                      AND DATE(punch_time) = $2
                      AND punch_type IN ('IN', 'OUT')
                      AND CAST(punch_time AS TIME) > $3::TIME 
                      AND CAST(punch_time AS TIME) < $4::TIME
                    GROUP BY DATE(punch_time);
                `;

                const autorizTimes = await client.query(authorizationQuery, [
                    employeeId, 
                    shift.shift_date, 
                    getin, 
                    getout
                ]);

                const autoriz_getin = autorizTimes.rows[0]?.autoriz_getin_time 
                    ? formatTime(new Date(autorizTimes.rows[0].autoriz_getin_time)) 
                    : null;
                const autoriz_getout = autorizTimes.rows[0]?.autoriz_getout_time 
                    ? formatTime(new Date(autorizTimes.rows[0].autoriz_getout_time)) 
                    : null;
                    

                // 5. Calcul des heures travaillées effectives
                if (getin && getin_ref && getin < getin_ref) {
                    workedHours = (new Date(`1970-01-01T${getout}:00`) - 
                                 new Date(`1970-01-01T${getin_ref}:00`)) / 3600000;
                }

                // Soustraction des heures d'autorisation s'il y'en a
                if (autoriz_getin && autoriz_getout) {
                    const authDuration = (new Date(`1970-01-01T${autoriz_getout}:00`) - 
                                        new Date(`1970-01-01T${autoriz_getin}:00`)) / 3600000;
                    workedHours = Math.max(workedHours - authDuration, MIN_WORK_HOURS);
                }

                // soustraction de la pause
                workedHours = parseFloat(
                    Math.max(workedHours - breakDuration, MIN_WORK_HOURS).toFixed(HOURS_PRECISION)
                );


                // 7. Update the summary record
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        getin = $3::TIME,
                        getout = $4::TIME,
                        autoriz_getin = $5::TIME,
                        autoriz_getout = $6::TIME,
                        is_today = $8,
                        nbr_absence = 0,
                        status = CASE
                            WHEN ($7::NUMERIC = 0 ) AND is_anomalie = FALSE THEN 'absent'
                            WHEN getin_ref IS NULL THEN 'present'
                            WHEN $3::TIME <= getin_ref THEN 'present'
                            ELSE 'retard'
                        END,
                        get_holiday = CASE
                            WHEN $3 IS NULL THEN FALSE
                            WHEN getin_ref IS NULL THEN TRUE
                            ELSE TRUE
                        END,
                        nbr_retard = CASE
                            WHEN $3::TIME <= getin_ref THEN 0
                            WHEN $3::TIME > getin_ref THEN 1
                        END,      
                        hours_worked = CASE
                            WHEN is_sunday THEN 0
                            ELSE $7::NUMERIC
                        END,
                        sunday_hour = CASE
                        WHEN is_sunday = TRUE THEN $7::NUMERIC
                        ELSE 0
                        END,
                        sup_hour = CASE
                        WHEN is_saturday = TRUE AND getin_ref is NULL THEN $7::NUMERIC
                        ELSE GREATEST($7::NUMERIC - normal_hours::NUMERIC, 0 )
                        END,
                        missed_hour = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        penalisable = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        updated_at = NOW()
                    WHERE employee_id = $1 AND date = $2
                    AND isholidays IS NOT TRUE 
                    AND is_conge IS NOT TRUE 
                    AND islayoff IS NOT TRUE  
                    AND is_congex IS NOT TRUE  
                    AND do_not_touch IS NOT TRUE
                    AND is_maladie IS NOT TRUE  
                    AND status NOT IN ('mission', 'remote')
                    AND is_accident IS NOT TRUE ;
                `, [
                    employeeId, //$1
                    shift.shift_date,   //$2
                    getin || null,  //$3
                    getout || null, //$4
                    autoriz_getin || null, //$5
                    autoriz_getout || null, //$6
                    workedHours || 0,   //$7
                    is_today  //$8
                ]);
                

            } catch (shiftError) {
                console.error(`❌ Error processing shift on ${shift.shift_date}:`, shiftError.message);
                // Continue with next shift even if one fails
                continue;
            }
        }

        console.log(`✅ Completed processing pour l'employé ${employeeId} à la date d'aujourd'hui`);
    } catch (error) {
        console.error(`❌ Critical error processing employee ${employeeId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}  

// Fonction pour mettre à jour les valeurs d'absences en cas d'heure travaillée non pénalisable
async function processMissedHours(employeeId, date) {
    if (!Number.isInteger(Number(employeeId))) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }

    const client = await pool.connect();

    try {
        await client.query(`
            UPDATE attendance_summary
            SET 
                nbr_absence = CASE
                    WHEN COALESCE(normal_hours, 0)::NUMERIC > 0 THEN 0
                    ELSE nbr_absence
                END,     
                missed_hour = CASE 
                    WHEN getin_ref IS NULL THEN 0
                    ELSE GREATEST(
                        COALESCE(normal_hours, 0)::NUMERIC - COALESCE(hours_worked, 0)::NUMERIC, 0
                    )
                END,
                penalisable = CASE
                    WHEN getin_ref IS NULL THEN 0
                    ELSE GREATEST(
                        COALESCE(normal_hours, 0)::NUMERIC 
                        - COALESCE(hours_worked, 0)::NUMERIC 
                        - COALESCE(night_hours, 0)::NUMERIC, 
                        0
                    )
                END,
                updated_at = NOW()
            WHERE employee_id = $1 
              AND date = $2
              AND isholidays IS NOT TRUE 
              AND is_conge IS NOT TRUE 
              AND islayoff IS NOT TRUE 
              AND is_congex IS NOT TRUE 
              AND do_not_touch IS NOT TRUE 
              AND is_maladie IS NOT TRUE  
              AND status NOT IN ('mission', 'remote', 'repos')
              AND is_accident IS NOT TRUE;
        `, [employeeId, date]);

        console.log(`✓ Heures manquées mises à jour pour l'employé ${employeeId} - ${date}`);
    } catch (err) {
        console.error(`❌ Erreur de mise à jour des heures manquées pour l'employé ${employeeId}:`, err.message);
    } finally {
        client.release();
    }
}

// Fonction pour traiter les pointages sauf ceux d'aujour'hui OK
async function processRegularShifts(employeeId, date) {
    // Constants for business rules
    const REGULAR_SHIFT_START_MINUTES = 4 * 60; // 4:00 AM (04:00)
    const REGULAR_SHIFT_END_MINUTES = 21 * 60; // 9:00 PM (21:00)
    const MIN_WORK_HOURS = 0;
    const HOURS_PRECISION = 2;

    
    // Construire manuellement les bornes locales sans décalage UTC
    const startDate = `${date} 00:00:00`;
    const endDate = `${date} 23:59:59`;



    if (!Number.isInteger(Number(employeeId))) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }

    const client = await pool.connect();
    try {
        console.log(`🌞 Calcul de pointage de employee de Matricule: ${employeeId} à une antérieure`);

        // 1. Fetch all regular shifts
        const regularShiftsQuery = `
        WITH ordered_punches AS (
            SELECT 
                id, 
                employee_id, 
                punch_time, 
                punch_type,
                DATE(punch_time) AS punch_date,
                EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) AS minutes_in_day
            FROM attendance_records
            WHERE employee_id = $1
              AND punch_time BETWEEN $4::timestamp AND $5::timestamp
              AND (EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) 
                   BETWEEN $2 AND $3)
        )
        SELECT 
            punch_time,
            punch_type,
            punch_date
        FROM ordered_punches
        ORDER BY punch_time
        `;

        const shifts = await client.query(regularShiftsQuery, [
            employeeId,
            REGULAR_SHIFT_START_MINUTES,
            REGULAR_SHIFT_END_MINUTES,
            startDate,
            endDate
        ]);

        // Group shifts by date
        const shiftsByDate = {};
        shifts.rows.forEach(shift => {
            const dateKey = shift.punch_date.toISOString().split('T')[0];
            if (!shiftsByDate[dateKey]) {
                shiftsByDate[dateKey] = [];
            }
            shiftsByDate[dateKey].push(shift);
        });

        // Process each day
        for (const [dateKey, dayShifts] of Object.entries(shiftsByDate)) {
            try {
                // Get all punches for the day
                const allPunchesQuery = `
                    SELECT 
                        punch_time,
                        punch_type
                    FROM attendance_records
                    WHERE employee_id = $1
                      AND DATE(punch_time) = $2
                    ORDER BY punch_time;
                `;
                const allPunches = await client.query(allPunchesQuery, [employeeId, dateKey]);

                console.log("les punchs par date", allPunches.rows);

                // Initialize variables
                let getin = null;
                let getout = null;
                let autoriz_getin = null;
                let autoriz_getout = null;
                let workedHours = 0;
                let effective_getin = null;

                // Process punches
                console.log("Nombre de punch: ", allPunches.rows.length);
                if (allPunches.rows.length === 4) {
                    // Cas exact de 4 pointages
                    getin = formatTime(allPunches.rows[0].punch_time);
                    autoriz_getout = formatTime(allPunches.rows[1].punch_time);
                    autoriz_getin = formatTime(allPunches.rows[2].punch_time);
                    getout = formatTime(allPunches.rows[3].punch_time);
                }
                else if (allPunches.rows.length >= 2) {
                    // Cas générique (2, 3, 5, 6, etc.)
                    const firstIn = allPunches.rows.find(p => p.punch_type === 'IN');
                    if (firstIn) getin = formatTime(firstIn.punch_time);

                    const lastOut = [...allPunches.rows].reverse().find(p => p.punch_type === 'OUT');
                    if (lastOut) getout = formatTime(lastOut.punch_time);

                    if (allPunches.rows.length === 3) {
                        const inIndexes = allPunches.rows
                            .map((p, i) => p.punch_type === 'IN' ? i : -1)
                            .filter(i => i !== -1);

                        const outIndexes = allPunches.rows
                            .map((p, i) => p.punch_type === 'OUT' ? i : -1)
                            .filter(i => i !== -1);

                        if (inIndexes.length > 0 && outIndexes.length > 0) {
                            // Premier OUT après premier IN → autoriz_getout
                            const firstOutAfterFirstIn = outIndexes.find(oi => oi > inIndexes[0]);
                            if (firstOutAfterFirstIn !== undefined) {
                                autoriz_getout = formatTime(allPunches.rows[firstOutAfterFirstIn].punch_time);
                            }

                            // Dernier IN avant dernier OUT → autoriz_getin
                            const lastInBeforeLastOut = [...inIndexes]
                                .reverse()
                                .find(ii => ii < outIndexes[outIndexes.length - 1]);
                            if (lastInBeforeLastOut !== undefined) {
                                autoriz_getin = formatTime(allPunches.rows[lastInBeforeLastOut].punch_time);
                            }
                        }
                    }
                }


                // Get shift summary data
                const summaryQuery = `
                    SELECT 
                        getin_ref, 
                        getout_ref,
                        break_duration
                    FROM attendance_summary
                    WHERE employee_id = $1 
                      AND date = $2
                      AND isholidays = FALSE 
                      AND is_conge = FALSE 
                      AND islayoff = FALSE
                    LIMIT 1;
                `;
                const summaryResult = await client.query(summaryQuery, [employeeId, dateKey]);
                
                if (summaryResult.rows.length === 0) continue;
                
                const summary = summaryResult.rows[0];
                // Extraire seulement les heures et minutes de getin_ref (format HH:MM:SS)
                const getin_ref = summary.getin_ref ? formatTimeFromString(summary.getin_ref) : null;
                const getout_ref = summary.getout_ref ? formatTimeFromString(summary.getout_ref) : null;
                const breakDuration = parseFloat(summary.break_duration) || 0;

                // Déterminer l'heure d'entrée effective
                if (getin && getin_ref) {
                    const getinTime = new Date(`1970-01-01T${getin}:00`);
                    const getinRefTime = new Date(`1970-01-01T${getin_ref}:00`);
                    
                    // Si getin est inférieur à getin_ref, on prend getin_ref ///// a optimiser
                    effective_getin = (getinTime <= getinRefTime) ?getin_ref : getin;
                } else {
                    effective_getin = getin; // Si une des valeurs est manquante
                }

                // Calculate worked hours avec l'heure d'entrée effective
                if (effective_getin && getout) {
                    workedHours = (new Date(`1970-01-01T${getout}:00`) - 
                                 new Date(`1970-01-01T${effective_getin}:00`)) / 3600000;

                    // Subtract authorization period if exists
                    if (autoriz_getin && autoriz_getout) {
                        const authDuration = (new Date(`1970-01-01T${autoriz_getin}:00`) - 
                                          new Date(`1970-01-01T${autoriz_getout}:00`)) / 3600000;
                        workedHours = Math.max(workedHours - authDuration, MIN_WORK_HOURS);
                    }
                }

                // Subtract break   
                workedHours = parseFloat(
                    Math.max(workedHours - breakDuration, MIN_WORK_HOURS).toFixed(HOURS_PRECISION)
                );
                const is_missing = (getin == null && getout == null)
                
                // Vérifie si le nombre de pointages est impair (indiquant une anomalie)
                const is_anomalie = allPunches.rows.length % 2 !== 0;

                // Update attendance summary
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        getin = $3::TIME,
                        getout = $4::TIME,
                        autoriz_getin = $5::TIME,
                        autoriz_getout = $6::TIME,
                        is_anomalie = $8,
                        hours_worked = CASE
                            WHEN is_sunday THEN 0
                            ELSE $7::NUMERIC
                        END,
                        status = CASE
                            WHEN ($7::NUMERIC = 0) AND is_anomalie = FALSE  THEN 'absent'
                            WHEN getin_ref IS NULL THEN 'present'
                            WHEN $3::TIME <= getin_ref::TIME THEN 'present'
                            ELSE 'retard'
                        END,
                        get_holiday = CASE
                            WHEN $3 IS NULL THEN FALSE
                            WHEN getin_ref IS NULL THEN TRUE
                            ELSE TRUE
                        END,
                        nbr_retard = CASE
                            WHEN $3::TIME <= getin_ref::TIME THEN 0
                            WHEN $3::TIME > getin_ref::TIME THEN 1
                        END,  
                        nbr_absence = CASE
                            WHEN $9 IS TRUE THEN 1
                            ELSE 0
                        END, 
                        nbr_depanti = CASE
                            WHEN $4::TIME < getout_ref::TIME THEN 1
                            ELSE 0
                        END,
                        sunday_hour = CASE
                        WHEN is_sunday = TRUE THEN $7::NUMERIC
                        ELSE 0
                        END,
                        sup_hour = CASE
                        WHEN is_saturday = TRUE AND getin_ref is NULL THEN $7::NUMERIC
                        ELSE GREATEST($7::NUMERIC - normal_hours::NUMERIC, 0 )
                        END,
                        missed_hour = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        penalisable = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        updated_at = NOW()
                    WHERE employee_id = $1 AND date = $2
                    AND isholidays IS NOT TRUE 
                    AND is_conge IS NOT TRUE 
                    AND islayoff IS NOT TRUE  
                    AND is_congex IS NOT TRUE  
                    AND do_not_touch IS NOT TRUE
                    AND is_maladie IS NOT TRUE  
                    AND status NOT IN ('mission', 'remote')
                    AND is_accident IS NOT TRUE ;
                `, [
                    employeeId,     //$1
                    dateKey,        //$2
                    getin,          //$3
                    getout,         //$4
                    autoriz_getin,  //$5
                    autoriz_getout, //$6
                    workedHours,    //$7
                    is_anomalie,    //$8
                    is_missing       //$9
                ]);

            } catch (dayError) {
                console.error(`❌ Error processing day ${dateKey}:`, dayError.message);
                continue;
            }
        }

        console.log(`✅ Completed processing for employee ${employeeId}`);
    } catch (error) {
        console.error(`❌ Critical error processing employee ${employeeId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }

    function formatTime(dateTime) {
        if (!dateTime || isNaN(new Date(dateTime).getTime())) return null;
        const d = new Date(dateTime);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function formatTimeFromString(timeString) {
        if (!timeString) return null;
        // Convertir le format HH:MM:SS en HH:MM
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        return null;
    }
}


// Fonction de Calcul et mis à jour Attendance_summary from Pointage Manuel
async function updateAttendanceSummaryFromTimes(employeeId, date, getin, getout, autorizgetOut, autorizgetIn) {
    // Constants for business rules
    const MIN_WORK_HOURS = 0; // Minimum worked hours can't be negative
    const HOURS_PRECISION = 2; // Decimal places for hours calculations

    if (!Number.isInteger(Number(employeeId))) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }

    const client = await pool.connect();
    try {
        console.log(`🔄 Updating attendance summary for employee ${employeeId} on ${date}`);

        // Format times safely
        const formatTime = (timeStr) => {
            if (!timeStr) return null;
            try {
                // Handle both Date objects and time strings
                const d = new Date(timeStr);
                if (isNaN(d.getTime())) {
                    // If not a valid Date, try parsing as time string
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                    return null;
                }
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } catch {
                return null;
            }
        };

        const formattedGetin = formatTime(getin);
        const formattedGetout = formatTime(getout);
        const formatedAutorizGetOut = formatTime(autorizgetOut);
        const formatedAutorizGetIn = formatTime(autorizgetIn);

        const is_anomalie = (formattedGetin == null || formattedGetout == null);


        let PAUSE_IN_AUTORIZ = 0;
        if (formatedAutorizGetOut && formatedAutorizGetIn) {
            const outTime = new Date(`1970-01-01T${formatedAutorizGetOut}:00`);
            const inTime = new Date(`1970-01-01T${formatedAutorizGetIn}:00`);
            
            // Vérifie si la pause déjeuner standard est incluse dans la période d'autorisation
            const lunchStart = new Date(`1970-01-01T12:00:00`);  // Dans la version superieure il faut le recuperer dans attendance_summary 
            const lunchEnd = new Date(`1970-01-01T12:30:00`); // Dans la version superieure il faut le recuperer dans attendance_summary 
            
            if (outTime <= lunchStart && inTime >= lunchEnd) {
                PAUSE_IN_AUTORIZ = 0.5;
            }
        }

        // Calculate worked hours
        let workedHours = 0;
        if (formattedGetin && formattedGetout) {
            workedHours = (new Date(`1970-01-01T${formattedGetout}:00`) - 
                         new Date(`1970-01-01T${formattedGetin}:00`)) / 3600000;
            workedHours = parseFloat(Math.max(workedHours, MIN_WORK_HOURS).toFixed(HOURS_PRECISION));
        }

        // Calculate autoriz hours
        let autorizHours = 0;
        if (formatedAutorizGetIn && formatedAutorizGetOut) {
            autorizHours = (new Date(`1970-01-01T${formatedAutorizGetIn}:00`) - 
                         new Date(`1970-01-01T${formatedAutorizGetOut}:00`)) / 3600000;
            autorizHours = parseFloat(Math.max(autorizHours, MIN_WORK_HOURS).toFixed(HOURS_PRECISION)) - PAUSE_IN_AUTORIZ;

        }

        // 1. Get shift summary data (reference times and break duration)
        const summaryQuery = `
            SELECT 
                getin_ref, 
                getout_ref,
                break_duration,
                normal_hours,
                is_sunday,
                is_saturday
            FROM attendance_summary
            WHERE employee_id = $1 
              AND date = $2
              AND isholidays = FALSE 
              AND is_conge = FALSE 
              AND islayoff = FALSE
            LIMIT 1;
        `;
        const summaryResult = await client.query(summaryQuery, [employeeId, date]);
        
        if (summaryResult.rows.length === 0) {
            console.log(`No attendance summary found for employee ${employeeId} on ${date}`);
            return;
        }
        
        const summary = summaryResult.rows[0];
        const getin_ref = formatTime(summary.getin_ref);
        const getout_ref = formatTime(summary.getout_ref);
        const breakDuration = parseFloat(summary.break_duration) || 0;
        const normalHours = parseFloat(summary.normal_hours) || 0;
        const isSunday = summary.is_sunday;
        const isSaturday = summary.is_saturday;

        // Subtract break duration AND autorizHour if exist from worked hours
        workedHours = parseFloat(
            Math.max(workedHours - breakDuration - autorizHours, MIN_WORK_HOURS).toFixed(HOURS_PRECISION)
        );

        // 2. Update the summary record
        await client.query(`
            UPDATE attendance_summary
            SET 
                getin = $3::TIME,
                getout = $4::TIME,
                autoriz_getout = $8::TIME,
                autoriz_getin = $9::TIME,
                do_not_touch = TRUE,
                get_holiday = TRUE,
                is_anomalie = CASE 
                    WHEN is_today = TRUE THEN FALSE 
                    ELSE $6
                END,
                nbr_absence = 0,
                status = CASE
                    WHEN $3 IS NULL THEN 'absent'
                    WHEN getin_ref IS NULL THEN 'present'
                    WHEN $3::TIME <= getin_ref THEN 'present'
                    ELSE 'retard'
                END,
                nbr_retard = CASE
                    WHEN $3 IS NULL THEN 0
                    WHEN getin_ref IS NULL THEN 0
                    WHEN $3::TIME <= getin_ref THEN 0
                    WHEN $3::TIME > getin_ref THEN 1
                    ELSE 0
                END,  
                nbr_depanti = CASE
                    WHEN $4 IS NULL THEN 0
                    WHEN getout_ref IS NULL THEN 0
                    WHEN $4::TIME < getout_ref THEN 1
                    ELSE 0
                END,    
                hours_worked = $5::NUMERIC,
                sunday_hour = CASE
                    WHEN is_sunday = TRUE THEN $5::NUMERIC
                    ELSE 0
                END,
                sup_hour = CASE
                    WHEN is_sunday IS NOT TRUE THEN GREATEST($5::NUMERIC - $7::NUMERIC, 0)
                    ELSE 0
                END,
                missed_hour = GREATEST($7::NUMERIC - $5::NUMERIC, 0),
                penalisable = GREATEST($7::NUMERIC - $5::NUMERIC, 0),
                updated_at = NOW()
            WHERE employee_id = $1 AND date = $2::DATE;
        `, [
            employeeId, 
            date, 
            formattedGetin || null,
            formattedGetout || null,
            workedHours || 0,
            is_anomalie,
            normalHours,
            formatedAutorizGetOut || null,
            formatedAutorizGetIn || null
        ]);

        // 3 Update week attendance
        await update_week_attendance_by_employee(employeeId, date);

        console.log(`✅ Successfully updated attendance summary for employee ${employeeId} on ${date}`);
    } catch (error) {
        console.error(`❌ Error updating attendance summary for employee ${employeeId} on ${date}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}



// Fonction pour eliminer les attendance_summary weekend sans travail ou sans pointages
async function deleteUnusedAttendanceSummary(employeeId = null) {
    const client = await pool.connect();
    
    try {
        console.log('Nettoyage des attendance_summary non pertinents');
        
        // Construction de la requête dynamique
        let query = `
            DELETE FROM attendance_summary
            WHERE 
                (hours_worked IS NULL OR hours_worked = 0) AND
                (sup_hour IS NULL OR sup_hour = 0) AND
                (night_hours IS NULL OR night_hours = 0) AND
                (sunday_hour IS NULL OR sunday_hour = 0) AND
                isholidays = FALSE AND 
                is_weekend = TRUE AND
                is_anomalie = FALSE AND
                do_not_touch = FALSE AND
                is_today = FALSE
        `;
        
        // Ajout du filtre par employé si spécifié
        const params = [];
        if (employeeId) {
            query += ` AND employee_id = $1`;
            params.push(employeeId);
        }
        
        // Exécution de la suppression
        const result = await client.query(query, params);
        
        console.log(`✅ ${result.rowCount} enregistrement(s) supprimé(s) avec succès !`);
        return result.rowCount;
        
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour eliminer les attendance_summary weekend après ajout d'indisponibilité
async function deleteAttendanceSummary(employeeId = null, start_date, end_date) {
    const client = await pool.connect();
    
    try {
        console.log('Nettoyage des summaries weekend sans getin_ref');
        
        //  with pg-format or template literals
        const conditions = [
            'getin_ref IS NULL',  
            'getin IS NULL',  // même en weekend l'employé peut travailler
            'getout IS NULL', 
            'is_weekend = TRUE',
            `date BETWEEN '${start_date}' AND '${end_date}'`
        ];
        
        if (employeeId) {
            conditions.push(`employee_id = ${employeeId}`);
        }
        
        const whereClause = conditions.join(' AND ');
        const query = `DELETE FROM attendance_summary WHERE ${whereClause}`;
        
        console.log('Executing query:', query);
        
        const result = await client.query(query);
        
        console.log(`✅ ${result.rowCount} enregistrement(s) supprimé(s) avec succès !`);
        return result.rowCount;
        
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour eliminer les attendance_summary  sans travail ou sans pointages
async function cleanAttendanceSummary(employeeId) {
    const client = await pool.connect();
    
    try {
        console.log('Nettoyage des attendance_summary non pertinents');
        
        // Construction de la requête dynamique
        let query = `
            DELETE FROM attendance_summary
            WHERE 
                (hours_worked IS NULL OR hours_worked = 0) AND
                (sup_hour IS NULL OR sup_hour = 0) AND
                (night_hours IS NULL OR night_hours = 0) AND
                (sunday_hour IS NULL OR sunday_hour = 0) AND
                isholidays = FALSE AND 
                is_conge = FALSE AND 
                islayoff = FALSE AND
                is_congex = FALSE AND
                is_maladie = FALSE AND 
                is_accident = FALSE AND
                is_anomalie = FALSE AND
                status NOT IN ('mission', 'remote') AND
                is_today = FALSE
        `;
        
        // Ajout du filtre par employé si spécifié
        const params = [];
        if (employeeId) {
            query += ` AND employee_id = $1`;
            params.push(employeeId);
        }
        
        // Exécution de la suppression
        const result = await client.query(query, params);
        
        console.log(`✅ ${result.rowCount} enregistrement(s) supprimé(s) avec succès !`);
        return result.rowCount;
        
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour eliminer les attendance_summary weekend sans travail ou sans pointages
async function deletAttendanceSummary(employeeId, date) {
    const client = await pool.connect();
    
    try {
        console.log('Nettoyage des attendance_summary ');
        
        // Construction de la requête dynamique
        let query = `
            DELETE FROM attendance_summary
            WHERE 
                do_not_touch IS NOT TRUE
                AND date = $1
                AND employee_id = $2
        `;
        
        // Ajout du filtre par employé si spécifié
        const params = [date, employeeId];
        
        // Exécution de la suppression
        const result = await client.query(query, params);
        
        console.log(`✅ ${result.rowCount} enregistrement(s) supprimé(s) avec succès !`);
        return result.rowCount;
        
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour mettre à jour les week_attendance avec les données de attendance_summary
async function update_week_attendance() {
    const client = await pool.connect();
    try {
        console.log("🔄 Mise à jour des totaux dans week_attendance");

        const { rows: employees } = await client.query('SELECT id, attendance_id FROM employees');
        if (employees.length === 0) {
            console.log('Aucun employé trouvé.');
            return;
        }

        const getWeeklySummaryQuery = `
            SELECT 
                SUM(night_hours) as total_night_hours,
                SUM(hours_worked) as total_worked_hours,
                SUM(normal_hours) as total_normal_hours,
                SUM(hrs_norm_trav) as total_normal_trav,
                SUM(penalisable) as total_penalisable,
                SUM(jf_value) as total_jf,
                SUM(sup_hour) as total_sup,
                SUM(missed_hour) as total_missed_hours,
                SUM(sunday_hour) as total_sunday_hours,
                SUM(worked_hours_on_holidays) as total_htjf
            FROM attendance_summary
            WHERE employee_id = $1 AND status <> 'map' AND status <> 'conge' AND status <> 'cg_exp'
            AND status <> 'mission'
            AND status <> 'remote'
            AND date BETWEEN $2 AND $3
        `;

        const getWeeklySummaryQuery_exclude = `
            SELECT 
                SUM(missed_hour) as exclude_missed_hours,
                SUM(jc_value) as exclude_jc
            FROM attendance_summary
            WHERE employee_id = $1 
            AND status = 'conge'
            AND date BETWEEN $2 AND $3
        `;

        const getWeeklySummaryQuery_map = `
        SELECT 
            SUM(missed_hour) as map_missed_hours
        FROM attendance_summary
        WHERE employee_id = $1 
        AND status = 'map'
        AND date BETWEEN $2 AND $3
    `;

        const getWeeklySummaryQuery_exep = `
            SELECT 
                SUM(missed_hour) as exep_missed_hours,
                SUM(jcx_value) as exep_jcx
            FROM attendance_summary
            WHERE employee_id = $1 
            AND status = 'cg_exp'
            AND date BETWEEN $2 AND $3
        `;

        const updateQuery = `
            UPDATE week_attendance
            SET 
                total_night_hours = $4,
                total_worked_hours = $5,
                total_penalisable = $6,
                total_normal_hour = $14,
                total_normal_trav = $15,
                total_sup = $7,
                total_missed_hours = $8,
                total_sunday_hours = $9,
                total_jf = $10,
                total_jc = $11,
                total_htjf = $12,
                total_jcx = $13
            WHERE name = $1 AND employee_id = $2 AND start_date = $3
        `;

        for (const employee of employees) {
            try {
                await client.query('BEGIN');

                const { rows: weeks } = await client.query(
                    'SELECT name, start_date, end_date FROM week_attendance WHERE employee_id = $1 ORDER BY start_date',
                    [employee.attendance_id]
                );

                for (const week of weeks) {
                    // normal
                    const { rows: [weeklyData] } = await client.query(getWeeklySummaryQuery, [
                        employee.attendance_id,
                        week.start_date,
                        week.end_date
                    ]);

                    // mis à pied somme
                    const { rows: [mapData] } = await client.query(getWeeklySummaryQuery_map, [
                        employee.attendance_id,
                        week.start_date,
                        week.end_date
                    ]);

                    // conge simple somme
                    const { rows: [excludeData] } = await client.query(getWeeklySummaryQuery_exclude, [
                        employee.attendance_id,
                        week.start_date,
                        week.end_date
                    ]);
                    // conge exceptionnel somme
                    const { rows: [exepData] } = await client.query(getWeeklySummaryQuery_exep, [
                        employee.attendance_id,
                        week.start_date,
                        week.end_date
                    ]);
                    const excludeMissedhour =  parseFloat(excludeData.exclude_missed_hours) || 0; // heure absence non compensées (mise à pied // congé)
                    const exepMissedhour =  parseFloat(exepData.exep_missed_hours) || 0; // heure absence non compensées (congé excep)
                    const mapMissedhour = parseFloat(mapData.map_missed_hours) || 0;   // heure absence non compensées (mis à pied)

                    const totalNormal = parseFloat(weeklyData.total_normal_hours) || 0;
                    const totalNormalTrav = parseFloat(weeklyData.total_normal_trav || 0);
                    const totalWorked = parseFloat(weeklyData.total_worked_hours) || 0;
                    const totalNighthour = parseFloat(weeklyData.total_night_hours) || 0;
                    const totalMissedhour =  parseFloat(weeklyData.total_missed_hours) || 0;
                    const totalSup50 = parseFloat(weeklyData.total_sup) || 0;
                    let totalsup = Math.max((totalWorked - 48), 0); // Heure sup calculé au delà de 48h par semaine !
                    const compasedHour = totalMissedhour - totalSup50;
                    const totalMissed = Math.max(compasedHour, 0) + excludeMissedhour + exepMissedhour + mapMissedhour;  
                    const totalPenalisable = Math.max((totalMissed - totalNighthour), 0);

                    if (compasedHour > 0) {
                        totalsup -= compasedHour ;
                        keepsuppositif = Math.max(totalsup, 0);
                        totalsup =  keepsuppositif;
                    };
                

                    await client.query(updateQuery, [
                        week.name,                                      // $1
                        employee.attendance_id,                         // $2
                        week.start_date,                                // $3
                        parseFloat(weeklyData.total_night_hours) || 0,  // $4
                        totalWorked,                                    // $5
                        totalPenalisable,                               // $6
                        totalsup,                                       // $7
                        totalMissed,                                    // $8
                        parseFloat(weeklyData.total_sunday_hours) || 0, // $9
                        parseInt(weeklyData.total_jf) || 0,             // $10
                        parseInt(excludeData.exclude_jc) || 0,             // $11
                        parseInt(weeklyData.total_htjf) || 0,           // $12
                        parseInt(exepData.exep_jcx) || 0,            // $13
                        totalNormal,                                     // $14
                        totalNormalTrav                                   //$15
                    ]);
                }

                await client.query('COMMIT');
                console.log(`✓ ${weeks.length} semaines mises à jour pour l'employé ${employee.attendance_id}`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ Erreur pour l'employé ${employee.attendance_id}:`, error.message);
            }
        }

        console.log(`✅ Totaux mis à jour pour ${employees.length} employés`);
    } catch (error) {
        console.error("❌ Erreur globale:", error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction attendance_summary
async function attendanceSummary(employeeId,employee_innerID, date) {
    try {
        console.log(`📅 Traitement de la présence pour l'employé ${employeeId} à la date ${date}`);

        // Appel de la fonction d'initialisation de l'attendance summary
        await initAttendanceSummary(employeeId, date);

        // Appel de la fonction pour traiter les shifts de travail de l'employé
        await employeeWorkShift(date, employeeId, employee_innerID);

         // Appel de la fonction pour traiter les indisponibilités de l'employé
         await employeeUnvailable(date, employeeId, employee_innerID);

         // Appel de la fonction pour vérifier les jours fériés
         await employeeHoliday(date, employeeId);

        // Appel de la fonction pour traiter les shifts réguliers de l'employé
        await processRegularShifts(employeeId, date);

        // Appel de la fonction pour traiter les shifts réguliers de l'employé pour aujourd'hui
        await forToday(employeeId, date);

        // Appel de la fonction pour traiter les shifts de nuit de l'employé
        await processNightShifts(employeeId);

        // Mis à jour des Heures d'absence TEST PHASE
        await processMissedHours(employeeId, date);

        // Nettoyage des attendance_summary
        await deleteUnusedAttendanceSummary(employeeId);


        console.log(`✅ Traitement de l'attendance summary terminé pour l'employé ${employeeId} à la date ${date}`);
    } catch (error) {
        console.error(`❌ Erreur lors du traitement de l'attendance summary pour l'employé ${employeeId} à la date ${date}:`, error);
        throw error;
    }
}

// decallage entre aujourd'hui et date de depart des calculs
async function decalageDay(date) {
    // Convertir en objet Date si c'est une chaîne
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // S'assurer que c'est une Date valide
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        console.error('Date invalide reçue:', date);
        return 0; // ou une valeur par défaut
    }
    
    const today = new Date();
    
    // Normaliser les dates pour ignorer l'heure
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const normalizedDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    
    const diffInMs = Math.abs(normalizedToday - normalizedDate);
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    console.log(`Calcul décalage: ${date} -> ${days} jours`);
    return days;
}

// fonction pour traiter les pointages sur une période donnée
async function processMonthlyAttendance(dateDebut) {

    // Calcul dynamique de la période : aujourd'hui et 3/1 jours avant
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    // ATTENDRE le résultat de decalageDay
    const decalage = await decalageDay(dateDebut);

    const start = new Date();
    start.setDate(start.getDate() - decalage); // enlever le decallage calculé
    const startDate = start.toISOString().split('T')[0];

    const client = await pool.connect();
    try {
        console.log(`📅 Traitement des résumés d'attendance pour tous les employés entre ${startDate} et ${endDate}`);

        // Récupérer tous les employés
        const employeesQuery = 'SELECT id, attendance_id FROM employees ORDER BY attendance_id';
        const employeesResult = await client.query(employeesQuery);

        // Vérifier qu'il y a des employés
        if (employeesResult.rows.length === 0) {
            console.log('Aucun employé trouvé.');
            return;
        }

        // Boucle sur chaque employé et application de la fonction attendanceSummary pour chaque date de la période
        for (let currentDate = new Date(startDate); currentDate <= new Date(endDate); currentDate.setDate(currentDate.getDate() + 1)) {
            const dateString = currentDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
            console.log(`🌟 Traitement des présences pour la date ${dateString}`);

            // Appliquer la fonction attendanceSummary pour chaque employé à la date spécifique
            for (const employee of employeesResult.rows) {
                try {
                    await attendanceSummary(employee.attendance_id,employee.id, dateString);
                } catch (error) {
                    console.error(`❌ Erreur lors du traitement de l'attendance pour l'employé ${employee.attendance_id} à la date ${dateString}:`, error);
                }
            }
        }

        // Mise à jour des totaux hebdomadaire
        await update_week_attendance();
        
        // Mise à jour des totaux mensuel
        await update_monthly_attendance();

        // Mise à jour de la prime d'assiduité
        await prime_assiduite();

        // Verifier les Employees qui ont 5 mois d'anniversaires
        //await checkFiveMonthsAnniversary();

        console.log(`✅ Traitement des résumés d'attendance terminé pour tous les employés.`);

    } catch (error) {
        console.error('❌ Erreur lors du traitement des résumés d\'attendances mensuels:', error);
        throw error;
    } finally {
        client.release();
    }
}

// fonction pour traiter les pointages sur une période donnée
async function apresAjoutIndisponibility(start_date, end_date, employee_id) {

    const employeeId = employee_id;
     // Convertir les dates en objets Date
    const originalStart = new Date(start_date);
    const originalEnd = new Date(end_date);
 
     // Ajuster les dates : n jours avant le début et n jours après la fin
    const startDate = new Date(originalStart);
    startDate.setDate(startDate.getDate() - 1);
 
    const endDate = new Date(originalEnd);
    endDate.setDate(endDate.getDate() + 1);

    const client = await pool.connect();
    try {
        console.log(`📅 Traitement des résumés d'attendance entre ${startDate} et ${endDate}`);

        // Récupérer les données de l'employé
        const employeesQuery = 'SELECT id, attendance_id FROM employees WHERE id = $1';
        const employeesResult = await client.query(employeesQuery, [employeeId]); // pass the employeeId as a parameter

        // Vérifier qu'il y a les données de l'employé
        if (employeesResult.rows.length === 0) {
            console.log('Aucune donnée trouvée.');
            return;
        }

        // Boucle et application de la fonction attendanceSummary pour chaque date de la période
        for (let currentDate = new Date(startDate); currentDate <= new Date(endDate); currentDate.setDate(currentDate.getDate() + 1)) {
            const dateString = currentDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
            console.log(`🌟 Traitement des présences pour la date ${dateString}`);

            // Appliquer la fonction attendanceSummary  à la date spécifique
            for (const employee of employeesResult.rows) {
                try {
                    await deleteAttendanceSummary(employee.attendance_id, dateString, dateString);
                    await update_week_attendance_by_employee(employee.attendance_id, dateString);
                    await update_monthly_attendance();
                } catch (error) {
                    console.error(`❌ Erreur lors du traitement de l'attendance pour l'employé ${employee.attendance_id} à la date ${dateString}:`, error);
                }
            }
        }

        console.log(`✅ Traitement des résumés d'attendance terminé pour tous les employés.`);

    } catch (error) {
        console.error('❌ Erreur lors du traitement des résumés d\'attendances mensuels:', error);
        throw error;
    } finally {
        client.release();
    }
}

// mis à jour de attendance summary après ajout ou modification de pointage manuel
async function processManualAttendance(date, employeeId) {
    
    const client = await pool.connect();
    try {
        console.log(`📅 Traitement de attendance_summary pour l' employé ${employeeId} à la date ${date}`);

        // Récupérer l'employee
        const employeesQuery = 'SELECT id FROM employees WHERE attendance_id = $1';
        const employeesResult = await client.query(employeesQuery, [employeeId]);

        // Vérifier que l'emloyé existe
        if (employeesResult.rows.length === 0) {
            console.log('Aucun employé trouvé.');
            return;
        }

        for (const employee of employeesResult.rows) {
             try {
                    await attendanceSummary(employeeId, employee.id, date);
             } catch (error) {
                    console.error(`❌ Erreur lors du traitement de l'attendance pour l'employé ${employeeId} à la date ${date}:`, error);
            }
        }
        
        console.log(`✅ Traitement des résumés d'attendance terminé pour cette employé.`);

    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error);
        throw error;
    } finally {
        client.release();
    }
}


// Version pour traiter tous les employés
async function processAllNightShifts() {
    console.log('[Début] Traitement des shifts de nuit pour tous les employés');
    
    try {
        // 1. Requête SQL pour recuperer les pointages nuit
        const { rows } = await pool.query(`
            SELECT DISTINCT employee_id
            FROM attendance_records
            WHERE (
                -- Pointages à partir de 20h30
                (EXTRACT(HOUR FROM punch_time) = 20 AND EXTRACT(MINUTE FROM punch_time) >= 30)
                OR
                (EXTRACT(HOUR FROM punch_time) > 20)
                OR
                -- Pointages jusqu'à 6h10
                (EXTRACT(HOUR FROM punch_time) < 6)
                OR
                (EXTRACT(HOUR FROM punch_time) = 6 AND EXTRACT(MINUTE FROM punch_time) <= 10)
            )
            AND punch_type IS NOT NULL
            ORDER BY employee_id`
        );

        console.log(`👥 ${rows.length} employés avec des pointages de nuit à traiter`);

        // 2. Traitement par lots pour améliorer les performances
        const BATCH_SIZE = 5;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            console.log(`\n--- Traitement du lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(rows.length/BATCH_SIZE)} ---`);
            
            await Promise.all(batch.map(async (row) => {
                try {
                    await processNightShifts(row.employee_id);
                } catch (err) {
                    console.error(`❌ Erreur sur employé ${row.employee_id}:`, err.message);
                    await pool.query(`
                        UPDATE attendance_summary
                        SET needs_review = TRUE,
                            review_reason = $1
                        WHERE employee_id = $2
                        AND has_night_shift = TRUE`,
                        [`Erreur traitement automatique: ${err.message.slice(0, 100)}`, row.employee_id]
                    );
                }
            }));
        }

        // 3. Requête de nettoyage
        const cleanupRes = await pool.query(`
            UPDATE attendance_summary s
            SET has_night_shift = FALSE,
                night_hours = 0,
                night_worked = NULL
            WHERE has_night_shift = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM attendance_records r
                WHERE r.employee_id = s.employee_id
                AND DATE(r.punch_time) = s.date
                AND (
                    (EXTRACT(HOUR FROM r.punch_time) = 20 AND EXTRACT(MINUTE FROM r.punch_time) >= 30)
                    OR
                    (EXTRACT(HOUR FROM r.punch_time) > 20)
                    OR
                    (EXTRACT(HOUR FROM r.punch_time) < 6)
                    OR
                    (EXTRACT(HOUR FROM r.punch_time) = 6 AND EXTRACT(MINUTE FROM r.punch_time) <= 10)
                )  -- ✅ Cette parenthèse ferme correctement le bloc précédent
                AND r.punch_type IS NOT NULL
            )
        `);
        

        console.log(`🧹 ${cleanupRes.rowCount} entrées obsolètes nettoyées`);
        console.log('[Fin] Traitement complet des shifts de nuit');
    } catch (error) {
        console.error('[ERREUR GLOBALE]', error);
        throw error;
    }
}


// Vérification des cohérences des shifts de nuit
async function verifyNightShiftConsistency(employeeId) {
    // Détecter les incohérences spécifiques aux shifts de nuit
    const issues = await pool.query(`
        WITH night_punches AS (
            SELECT *, 
                   EXTRACT(HOUR FROM punch_time) as hour,
                   LAG(punch_type) OVER (ORDER BY punch_time) as prev_type
            FROM attendance_records
            WHERE employee_id = $1
              AND (EXTRACT(HOUR FROM punch_time) >= 21 
                   OR EXTRACT(HOUR FROM punch_time) < 6)
        )
        SELECT id FROM night_punches
        WHERE (hour < 6 AND punch_type = 'IN' AND prev_type = 'IN')
           OR (hour >= 21 AND punch_type = 'OUT' AND prev_type = 'OUT')`,
        [employeeId]
    );

    // Correction automatique + flag pour review
    for (const issue of issues.rows) {
        await pool.query(`
            UPDATE attendance_records
            SET punch_type = CASE WHEN punch_type = 'IN' THEN 'OUT' ELSE 'IN' END,
                needs_review = TRUE
            WHERE id = $1`,
            [issue.id]
        );
    }
}


async function updateAttendanceSummary(employeeId) {
    const client = await pool.connect();
    try {
        console.log(`📊 Mise à jour du summary pour l'employé ${employeeId}`);

        // 1. Récupérer tous les pointages classifiés avec les heures de nuit
        const punches = await client.query(`
            SELECT 
                id,
                punch_time,
                punch_type,
                EXTRACT(HOUR FROM punch_time) as hour
            FROM attendance_records
            WHERE employee_id = $1
            ORDER BY punch_time`,
            [employeeId]
        );

        // 2. Récupérer tous les shifts programmés
        const scheduledShifts = await client.query(`
            SELECT 
                ws.*,
                d.date,
                EXTRACT(DOW FROM d.date) as day_of_week,
                (d.date)::text as date_str
            FROM 
                (SELECT generate_series(
                    CURRENT_DATE - INTERVAL '30 days', 
                    CURRENT_DATE + INTERVAL '30 days', 
                    '1 day'
                )::date AS date) d
            JOIN employee_work_shifts ews ON ews.employee_id = $1
            JOIN work_shifts ws ON ews.work_shift_id = ws.id
            WHERE d.date BETWEEN ws.start_date AND ws.end_date
            ORDER BY d.date`,
            [employeeId]
        );

        // 3. Traiter chaque jour de travail programmé
        for (const shift of scheduledShifts.rows) {
            const date = shift.date;
            const dateStr = shift.date_str;
            const dayOfWeek = shift.day_of_week; // 0=Dim, 1=Lun, ..., 6=Sam
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            
            // Trouver les pointages pour ce jour
            const dayPunches = punches.rows.filter(p => {
                const punchDate = new Date(p.punch_time).toISOString().split('T')[0];
                return punchDate === dateStr;
            });

            // Vérifier si l'employé a pointé ce jour-là
            const hasPunched = dayPunches.length > 0;
            const isOffDay = shift[`${dayOfWeek}_off`];
            const scheduledHours = shift[`${dayOfWeek}_end`] - shift[`${dayOfWeek}_start`] - (shift[`${dayOfWeek}_break`] / 60);

            // Variables de calcul
            let status = 'present';
            let regularHours = 0;
            let supHours = 0;
            let sundayHours = 0;
            let missedHours = 0;
            let getin = null;
            let getout = null;

            if (!isOffDay) {
                if (!hasPunched) {
                    // Cas d'absence complète
                    status = 'absent';
                    missedHours = scheduledHours;
                } else {
                    // Traitement des pointages existants
                    const inPunches = dayPunches.filter(p => p.punch_type === 'IN').sort((a, b) => a.punch_time - b.punch_time);
                    const outPunches = dayPunches.filter(p => p.punch_type === 'OUT').sort((a, b) => a.punch_time - b.punch_time);

                    if (inPunches.length > 0 && outPunches.length > 0) {
                        getin = inPunches[0].punch_time;
                        getout = outPunches[outPunches.length - 1].punch_time;
                        
                        // Calcul des heures travaillées (en heures)
                        const totalWorkedHours = (new Date(getout) - new Date(getin)) / (1000 * 60 * 60);
                        
                        // Soustraction de la pause si configurée
                        const workedHours = shift[`${dayOfWeek}_break`] > 0 
                            ? totalWorkedHours - (shift[`${dayOfWeek}_break`] / 60)
                            : totalWorkedHours;

                        // Calcul des heures manquées
                        missedHours = Math.max(scheduledHours - workedHours, 0);
                        
                    } else {
                        // Cas où il manque des pointages IN ou OUT
                        status = 'incomplete';
                        missedHours = scheduledHours;
                    }
                }
            }

            // 4. Mise à jour du summary
            await client.query(`
                INSERT INTO attendance_summary (
                    employee_id, 
                    date, 
                    status,
                    getin,
                    getout,
                    normal_hours,
                    sup_hour,
                    missed_hour,
                    has_regular_shift,
                    needs_review
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (employee_id, date) DO UPDATE SET
                    status = EXCLUDED.status,
                    getin = EXCLUDED.getin,
                    getout = EXCLUDED.getout,
                    normal_hours = EXCLUDED.normal_hours,
                    missed_hour = EXCLUDED.missed_hour,
                    sup_hour = EXCLUDED.sup_hour,
                    has_regular_shift = EXCLUDED.has_regular_shift,
                    needs_review = EXCLUDED.needs_review,
                    updated_at = NOW()
                WHERE attendance_summary.date = EXCLUDED.date`,
                [
                    employeeId,
                    date,
                    status,
                    getin ? formatTimeToHHMM(getin) : null,
                    getout ? formatTimeToHHMM(getout) : null,
                    regularHours,
                    supHours,
                    missedHours,
                    hasPunched, // has_regular_shift = true si pointages
                    dayPunches.some(p => p.needs_review)
                ]
            );

            console.log(`📅 ${dateStr} (${getDayName(dayOfWeek)}): 
                Statut: ${status} | 
                Régulier: ${regularHours.toFixed(2)}h | 
                Sup: ${supHours.toFixed(2)}h | 
                Manquées: ${missedHours.toFixed(2)}h`);
        }

        console.log(`✅ Summary mis à jour pour l'employé ${employeeId}`);
    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour du summary pour ${employeeId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

// Helper functions
function formatTimeToHHMM(dateTime) {
    if (!dateTime) return null;
    const date = new Date(dateTime);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function getDayName(dayOfWeek) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayOfWeek];
}

// Fonctions helper
function calculateDailyHours(punches, shift, dayOfWeek) {
    let workedMinutes = 0;
    let nightMinutes = 0;
    let outMinutes = 0;
    let currentIn = null;

    for (let i = 0; i < punches.length; i++) {
        const punch = punches[i];
        
        if (punch.punch_type === 'IN') {
            currentIn = punch.punch_time;
        } 
        else if (punch.punch_type === 'OUT' && currentIn) {
            const start = new Date(currentIn);
            const end = new Date(punch.punch_time);
            const durationMinutes = (end - start) / (1000 * 60);
            
            // Calcul des heures de nuit
            nightMinutes += calculateNightMinutes(start, end);
            
            // Détection des sorties autorisées (< 2h et pas dernier OUT)
            if (durationMinutes < 120 && i < punches.length - 1) {
                outMinutes += durationMinutes;
            } else {
                workedMinutes += durationMinutes;
            }
            
            currentIn = null;
        }
    }

    // Appliquer la pause si shift normal
    if (shift && !shift[`${dayOfWeek}_off`]) {
        workedMinutes = Math.max(workedMinutes - shift[`${dayOfWeek}_break`], 0);
    }

    return { workedMinutes, nightMinutes, outMinutes };
}

function calculateNightMinutes(start, end) {
    const NIGHT_START = 22 * 60; // 22h en minutes
    const NIGHT_END = 6 * 60;    // 6h en minutes
    
    const toMinutes = (date) => date.getHours() * 60 + date.getMinutes();
    
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    
    // Cas traversée de minuit
    if (start.getDate() !== end.getDate()) {
        const beforeMidnight = (24 * 60) - Math.max(startMin, NIGHT_START);
        const afterMidnight = Math.min(endMin, NIGHT_END);
        return beforeMidnight + afterMidnight;
    }
    // Cas même jour
    return Math.max(Math.min(endMin, NIGHT_END) - Math.max(startMin, NIGHT_START), 0);
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
}

// empacter dans ProcessAllAttendance
async function processEmployeeAttendance(employeeId) {
    try {
        
        // 2. Traitement spécial shifts de nuit
        await processNightShifts(employeeId);
        
        // 3. Vérification fine
        await verifyNightShiftConsistency(employeeId);
        
        // 4. Calcul des summaries
        await updateAttendanceSummary(employeeId);
        
        // 5. Notifier si besoin de vérification humaine
        const needsReview = await pool.query(
            `SELECT 1 FROM attendance_records 
             WHERE employee_id = $1 AND needs_review LIMIT 1`,
            [employeeId]
        );

        if (needsReview.rowCount > 0) {
            await flagForManualReview(employeeId);
        }

    } catch (error) {
        console.error(`Erreur traitement pointages employé ${employeeId}:`, error);
        await flagAsProcessingError(employeeId);
    }
}

async function processAllAttendances() {
    const client = await pool.connect();
    try {
        console.log("🔍 Récupération des employés");
        
        // 1. Récupérer tous les employés actifs
        const activeEmployees = await client.query(`
            SELECT id, attendance_id FROM employees
        `);

        if (activeEmployees.rows.length === 0) {
            console.log("ℹ️ Aucun employé actif trouvé");
            return;
        }

        console.log(`👥 ${activeEmployees.rows.length} employés actifs à traiter`);

        // 2. Traiter par lots avec contrôle de concurrence
        const concurrencyLimit = 5; // Nombre de traitements parallèles
        const batches = [];
        
        for (let i = 0; i < activeEmployees.rows.length; i += concurrencyLimit) {
            batches.push(activeEmployees.rows.slice(i, i + concurrencyLimit));
        }

        for (const batch of batches) {
            await Promise.all(
                batch.map(employee => 
                    processEmployeeAttendance(employee.attendance_id)
                        .catch(e => console.error(`⚠️ Erreur sur employé ${employee.id}:`, e))
            ));
            
            // Pause courte entre les batches pour éviter la surcharge
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Traitement terminé pour tous les employés');
    } catch (error) {
        console.error('❌ Erreur globale du traitement:', error);
        throw error;
    } finally {
        client.release();
    }
}


async function downloadAttendance(machine) {
    const ip = machine.ip_address;
    const port = machine.port;

    let counter = 0;

    const device = new Zkteco(ip, port, 5200, 5000);

    try {
        // Créer une connexion socket à l'appareil
        await device.createSocket();

        // Récupérer tous les enregistrements de pointage
        const attendanceLogs = await device.getAttendances();
                

        const datas = attendanceLogs.data;

        
    
        const startDate = moment().subtract(1, 'month').date(25).startOf('day').toDate();

        console.log("📆 Téléchargement des pointages depuis :", startDate.toISOString());



        for (const data of datas) {
            const { user_id, record_time } = data;


            // Ignorer si user_id ou record_time sont manquants
            if (!user_id || !record_time) {
                console.warn(`⏩ Pointage ignoré (incomplet) : user_id=${user_id}, record_time=${record_time}`);
                continue;
            }

            

            // Convertir record_time en objet Date
            const punchTime = new Date(record_time);

            // Vérifier si le pointage est après le 1er janvier 2025
            if (punchTime < startDate) {
                console.log(`⏩ Pointage ignoré (avant le 25 Mai 2025) : ${punchTime.toISOString()}`);
                console.log(`➡️ user_id: ${user_id}, raw record_time:`, record_time, '→', punchTime.toISOString());
                continue;
            }

            

            // Vérifier si l'employé existe
            const checkEmployee = await pool.query(
                "SELECT id FROM employees WHERE attendance_id = $1",
                [user_id]
            );

            if (checkEmployee.rowCount === 0) {
                console.warn(`⚠️ Employee ID ${user_id} does not exist. Skipping...`);
                continue;
            }

            // Vérifier si un pointage existe déjà pour cet employé dans un intervalle de 10 minutes
            const checkDuplicateQuery = `
                SELECT id
                FROM attendance_records
                WHERE employee_id = $1
                AND punch_time BETWEEN $2::timestamp - INTERVAL '10 minute' AND $2::timestamp + INTERVAL '10 minute';
            `;
            const duplicateResult = await pool.query(checkDuplicateQuery, [user_id, punchTime]);

            if (duplicateResult.rowCount > 0) {
                console.log(`⏩ Pointage ignoré (doublon dans un intervalle de 10 minutes) : ${punchTime}`);
                continue;
            }

            // Insérer dans la base de données, en ignorant les doublons
            const query = `
                INSERT INTO attendance_records (employee_id, shift_id, punch_time, punch_type, punch_source)
                VALUES ($1, NULL, $2, NULL, 'AUTO')
                ON CONFLICT (employee_id, punch_time, device_id) DO NOTHING;
            `;

            counter += 1; 

            await pool.query(query, [user_id, punchTime]);
        }

        // Déconnecter manuellement après avoir utilisé les logs en temps réel
        await device.disconnect();
        console.log(`✅ Pointages téléchargés depuis ${ip}:${port} => Nombre Télécharger: ${counter}`);
    } catch (error) {
        console.error("Erreur lors du téléchargement des pointages:", error);
        throw error;
    }
}

// Fonction pour créer des données sur la table week_attendance à partir des données de attendance_summary
async function init_week_attendance(month = moment().startOf('month')) {
    const client = await pool.connect();
    try {
        console.log("📅 Création des semaines sur la table week_attendance");

        // Fonction pour générer les semaines
        const generatePayPeriodWeeks = (payMonth) => {
            const startDate = payMonth.clone().subtract(1, 'month').date(26);
            const endDate = payMonth.clone().date(25);
            let currentStart = startDate.clone();
            const generatedWeeks = [];
            let weekNum = 1;

            // Format du mois de paie pour le nom (ex: "JUIN")
            const payMonthName = payMonth.format('MMMM').toUpperCase().substring(0, 4);
            const payYear = payMonth.year();

            while (currentStart.isBefore(endDate) || currentStart.isSame(endDate, 'day')) {
                // Début de semaine (pour la 1ère semaine c'est toujours le 26)
                const weekStart = weekNum === 1 ? startDate.clone() : currentStart.clone();
                
                // Fin de semaine - comportement spécial pour la première semaine
                let weekEnd;
                if (weekNum === 1) {
                    // Trouver le prochain dimanche
                    if (weekStart.day() === 0) { // Si le 26 est déjà un dimanche
                        weekEnd = weekStart.clone();
                    } else {
                        weekEnd = weekStart.clone().day(7); // Prochain dimanche
                    }
                } else {
                    // Pour les autres semaines: 6 jours après le début
                    weekEnd = weekStart.clone().add(6, 'days');
                }

                // Ne pas dépasser la date de fin (25)
                if (weekEnd.isAfter(endDate)) {
                    weekEnd = endDate.clone();
                }

                // Générer le nom de la semaine
                // TOUTES les semaines utilisent le mois de paie (payMonth) pour le nom
                const weekName = `S${weekNum}_${payMonthName}_${payYear}`;

                generatedWeeks.push({
                    name: weekName,
                    start: weekStart.clone(),
                    end: weekEnd.clone(),
                    weekNumber: weekNum,
                    year: payYear
                });

                currentStart = weekEnd.clone().add(1, 'day');
                weekNum++;
            }

            return generatedWeeks;
        };

        // Requête d'insertion pour la nouvelle structure
        const insertQuery = `
            INSERT INTO week_attendance (
                name, employee_id, start_date, end_date, total_normal_trav,
                total_night_hours, total_worked_hours, total_penalisable, 
                total_sup, total_missed_hours, total_sunday_hours, 
                total_jf, total_jc, total_htjf, total_jcx
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13, $14, $15
            )
            ON CONFLICT (name, employee_id) DO NOTHING
        `;

        // Récupérer tous les employés
        const { rows: employees } = await client.query('SELECT id, attendance_id FROM employees');
        if (employees.length === 0) {
            console.log('Aucun employé trouvé.');
            return;
        }

        // Déterminer le mois de paie
        const payMonth = moment().startOf('month');
        console.log(`🔄 Génération des semaines pour le mois de paie: ${payMonth.format('MMMM YYYY')}`);

        // Générer les semaines une seule fois (elles sont les mêmes pour tous les employés)
        const weeks = generatePayPeriodWeeks(payMonth);
        console.log(`📆 ${weeks.length} semaines générées`);

        // Afficher les semaines générées pour vérification
        console.log("Semaines générées:");
        weeks.forEach(week => {
            console.log(`${week.name} - ${week.start.format('YYYY-MM-DD')} au ${week.end.format('YYYY-MM-DD')}`);
        });

        // Insérer les données pour chaque employé
        for (const employee of employees) {
            try {
                // Utilisation d'une transaction par employé pour plus de sécurité
                await client.query('BEGIN');

                for (const week of weeks) {
                    await client.query(insertQuery, [
                        week.name,
                        employee.attendance_id,
                        week.start.format('YYYY-MM-DD'),
                        week.end.format('YYYY-MM-DD'),
                        0, // total_normal_trav
                        0, // total_night_hours
                        0, // total_worked_hours
                        0, // total_penalisable
                        0, // total_sup
                        0, // total_missed_hours
                        0, // total_sunday_hours
                        0, // total_jf
                        0, // total_jc
                        0, // total_htjf
                        0  // total_jcx
                    ]);
                }

                await client.query('COMMIT');
                console.log(`✓ Semaines créées pour l'employé ${employee.attendance_id}`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Erreur pour l'employé ${employee.attendance_id}:`, error);
            }
        }

        console.log("✅ Données créées avec succès dans week_attendance");
    } catch (error) {
        console.error("❌ Erreur lors de la création des données:", error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction pour créer des données sur la table mensuel
async function init_monthly_attendance(month = moment().startOf('month')) {
    const client = await pool.connect();
    try {
        console.log("📅 Création des semaines sur la table week_attendance");

        // Fonction pour générer les semaines
        const generatePayPeriodWeeks = (payMonth) => {
            const startDate = payMonth.clone().subtract(1, 'month').date(26);
            const endDate = payMonth.clone().date(25);
            let currentStart = startDate.clone();
            const generatedWeeks = [];
            let weekNum = 1;

            // Format du mois de paie pour le nom (ex: "JUIN")
            const payMonthName = payMonth.format('MMMM').toUpperCase().substring(0, 4);
            const payYear = payMonth.year();

            while (currentStart.isBefore(endDate) || currentStart.isSame(endDate, 'day')) {
                // Début de semaine (pour la 1ère semaine c'est toujours le 26)
                const weekStart = weekNum === 1 ? startDate.clone() : currentStart.clone();
                
                // Fin de semaine - comportement spécial pour la première semaine
                let weekEnd;
                if (weekNum === 1) {
                    // Trouver le prochain dimanche
                    if (weekStart.day() === 0) { // Si le 26 est déjà un dimanche
                        weekEnd = weekStart.clone();
                    } else {
                        weekEnd = weekStart.clone().day(7); // Prochain dimanche
                    }
                } else {
                    // Pour les autres semaines: 6 jours après le début
                    weekEnd = weekStart.clone().add(6, 'days');
                }

                // Ne pas dépasser la date de fin (25)
                if (weekEnd.isAfter(endDate)) {
                    weekEnd = endDate.clone();
                }

                // Générer le nom de la semaine
                // TOUTES les semaines utilisent le mois de paie (payMonth) pour le nom
                const weekName = `S${weekNum}_${payMonthName}_${payYear}`;

                generatedWeeks.push({
                    name: weekName,
                    start: weekStart.clone(),
                    end: weekEnd.clone(),
                    weekNumber: weekNum,
                    year: payYear
                });

                currentStart = weekEnd.clone().add(1, 'day');
                weekNum++;
            }

            return generatedWeeks;
        };

        // Requête d'insertion pour la nouvelle structure
        const insertQuery = `
            INSERT INTO week_attendance (
                name, employee_id, start_date, end_date, 
                total_night_hours, total_worked_hours, total_penalisable, 
                total_sup, total_missed_hours, total_sunday_hours, 
                total_jf, total_jc, total_htjf, total_jcx
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13, $14
            )
            ON CONFLICT (name, employee_id) DO NOTHING
        `;

        // Récupérer tous les employés
        const { rows: employees } = await client.query('SELECT id, attendance_id FROM employees');
        if (employees.length === 0) {
            console.log('Aucun employé trouvé.');
            return;
        }

        // Déterminer le mois de paie
        const payMonth = moment().startOf('month');
        console.log(`🔄 Génération des semaines pour le mois de paie: ${payMonth.format('MMMM YYYY')}`);

        // Générer les semaines une seule fois (elles sont les mêmes pour tous les employés)
        const weeks = generatePayPeriodWeeks(payMonth);
        console.log(`📆 ${weeks.length} semaines générées`);

        // Afficher les semaines générées pour vérification
        console.log("Semaines générées:");
        weeks.forEach(week => {
            console.log(`${week.name} - ${week.start.format('YYYY-MM-DD')} au ${week.end.format('YYYY-MM-DD')}`);
        });

        // Insérer les données pour chaque employé
        for (const employee of employees) {
            try {
                // Utilisation d'une transaction par employé pour plus de sécurité
                await client.query('BEGIN');

                for (const week of weeks) {
                    await client.query(insertQuery, [
                        week.name,
                        employee.attendance_id,
                        week.start.format('YYYY-MM-DD'),
                        week.end.format('YYYY-MM-DD'),
                        0, // total_night_hours
                        0, // total_worked_hours
                        0, // total_penalisable
                        0, // total_sup
                        0, // total_missed_hours
                        0, // total_sunday_hours
                        0, // total_jf
                        0, // total_jc
                        0, // total_htjf
                        0  // total_jcx
                    ]);
                }

                await client.query('COMMIT');
                console.log(`✓ Semaines créées pour l'employé ${employee.attendance_id}`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Erreur pour l'employé ${employee.attendance_id}:`, error);
            }
        }

        console.log("✅ Données créées avec succès dans week_attendance");
    } catch (error) {
        console.error("❌ Erreur lors de la création des données:", error);
        throw error;
    } finally {
        client.release();
    }
}



// Fonction pour mettre à jour les week_attendance après mis à jour d'un attendance_summary d'un employé
async function update_week_attendance_by_employee( employeeId, date) {
    const client = await pool.connect();
    try {
        console.log(`🔄 Mise à jour des totaux dans week_attendance pour l'employé ${employeeId} dans la semaine contenant la date ${date}`); 

        // 2. Requête pour récupérer les totaux par semaine pour un employé
        const getWeeklySummaryQuery = `
            SELECT 
                SUM(night_hours) as total_night_hours,
                SUM(hrs_norm_trav) as total_normal_trav,
                SUM(hours_worked) as total_worked_hours,
                SUM(penalisable) as total_penalisable,
                SUM(sup_hour) as total_sup,
                SUM(missed_hour) as total_missed_hours,
                SUM(sunday_hour) as total_sunday_hours,
                SUM(jf_value) as total_jf,
                SUM(jc_value) as total_jc,
                SUM(worked_hours_on_holidays) as total_htjf,
                SUM(jcx_value) as total_jcx
            FROM attendance_summary
            WHERE employee_id = $1 AND date BETWEEN $2 AND $3
        `;

        // 3. Requête de mise à jour
        const updateQuery = `
            UPDATE week_attendance
            SET 
                total_night_hours = $4,
                total_normal_trav = $14,
                total_worked_hours = $5,
                total_penalisable = $6,
                total_sup = $7,
                total_missed_hours = $8,
                total_sunday_hours = $9,
                total_jf = $10,
                total_jc = $11,
                total_htjf = $12,
                total_jcx = $13
            WHERE name = $1 AND employee_id = $2 AND start_date = $3
        `;

        // 4. Pour cet employé, récupérer ses semaines existantes
    
        try {
            await client.query('BEGIN');

            // Récupérer toutes les semaines existantes pour cet employé dans l'interval de date
            const { rows: weeks } = await client.query(
                'SELECT name, start_date, end_date FROM week_attendance WHERE employee_id = $1 AND start_date <= $2 AND end_date >= $2 ORDER BY start_date',
                [employeeId, date]
            );

            console.log('Les semaines recupérer sont: ', weeks);

            for (const week of weeks) {
                // Récupérer les données hebdomadaires
                const { rows: [weeklyData] } = await client.query(getWeeklySummaryQuery, [
                    employeeId,
                    week.start_date,
                    week.end_date
                ]);

                // Mettre à jour les données de la semaine
                await client.query(updateQuery, [
                    week.name,
                    employeeId,
                    week.start_date,
                    parseFloat(weeklyData.total_night_hours) || 0,
                    parseFloat(weeklyData.total_worked_hours) || 0,
                    parseFloat(weeklyData.total_penalisable) || 0,
                    parseFloat(weeklyData.total_sup) || 0,
                    parseFloat(weeklyData.total_missed_hours) || 0,
                    parseFloat(weeklyData.total_sunday_hours) || 0,
                    parseInt(weeklyData.total_jf) || 0,
                    parseInt(weeklyData.total_jc) || 0,
                    parseInt(weeklyData.total_htjf) || 0,
                    parseInt(weeklyData.total_jcx) || 0,
                    parseFloat(weeklyData.total_normal_hours) || 0
                ]);
            }

                await client.query('COMMIT');
                console.log(`✓ ${weeks.length} semaines mises à jour pour l'employé ${employeeId}`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Erreur lors de la mise à jour pour l'employé ${employeeId}:`, error);
            }

        console.log(`✅ Totaux mis à jour`);
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des totaux:", error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonction utilitaire pour obtenir le nom du jour en français
function getDayName(dayIndex) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
}

// Fonction utilitaire pour initialiser les données d'un jour
function initDayData() {
    return {
        penalisable: 0,
        missed: 0,
        sup: 0,
        work: 0,
        holiday: 0,
        jc: 0,
        jcx: 0,
        isActive: false
    };
}

// Fonction pour créer des données sur la table monthly_attendance à partir des données de week_attendance
async function init_month_attendance(month = moment().startOf('month')) {
    const client = await pool.connect();
    try {
        console.log("📅 Initialisation des mois de paie");

        // Obtenir la date actuelle
        const now = moment();
        
        // Calculer la période du 26 du mois précédent au 25 du mois courant
        const startDate = now.clone().subtract(1, 'month').date(26);
        const endDate = now.clone().date(25);

        // La période de paie correspond au MOIS_ANNEE du mois courant
        const periodePaie = now.format('MMMM_YYYY').toUpperCase()
            .replace('JANUARY', 'JANVIER')
            .replace('FEBRUARY', 'FÉVRIER')
            .replace('MARCH', 'MARS')
            .replace('APRIL', 'AVRIL')
            .replace('MAY', 'MAI')
            .replace('JUNE', 'JUIN')
            .replace('JULY', 'JUILLET')
            .replace('AUGUST', 'AOÛT')
            .replace('SEPTEMBER', 'SEPTEMBRE')
            .replace('OCTOBER', 'OCTOBRE')
            .replace('NOVEMBER', 'NOVEMBRE')
            .replace('DECEMBER', 'DÉCEMBRE');

        console.log(`🔄 Période de paie: ${periodePaie} (du ${startDate.format('DD/MM/YYYY')} au ${endDate.format('DD/MM/YYYY')})`);

        // Requête pour monthly_attendance
        const upsertMonthlyQuery = `
            INSERT INTO monthly_attendance (
                employee_id, payroll_id, employee_name, month_start, month_end, periode_paie
            ) VALUES (
                $1, $2, $3, $4::DATE, $5::DATE, $6
            )
            ON CONFLICT (employee_id, month_start) 
            DO UPDATE SET 
                periode_paie = EXCLUDED.periode_paie,
                updated_at = NOW()
        `;

        // Requête pour attendance_summary
        const updateSummaryQuery = `
            UPDATE attendance_summary
            SET periode_paie = $1
            WHERE date BETWEEN $2 AND $3
            AND employee_id = $4
        `;

        // Récupération des employés actifs
        const { rows: employees } = await client.query(`
            SELECT id, attendance_id, payroll_id, name 
            FROM employees 
            WHERE is_active = true
        `);

        if (employees.length === 0) {
            console.log('⚠️ Aucun employé actif trouvé');
            return;
        }

        console.log(`📅 ${employees.length} employés actifs à traiter`);

        // Traitement par employé
        for (const employee of employees) {
            try {
                await client.query('BEGIN');

                // Convertir attendance_id en string pour l'affichage
                const empId = employee.attendance_id.toString();
                const empName = employee.name || 'Nom inconnu';

                // 1. Mise à jour de monthly_attendance
                await client.query(upsertMonthlyQuery, [
                    employee.attendance_id,
                    employee.payroll_id,
                    employee.name,
                    startDate.format('YYYY-MM-DD'),
                    endDate.format('YYYY-MM-DD'),
                    periodePaie
                ]);

                // 2. Mise à jour de attendance_summary
                const { rowCount } = await client.query(updateSummaryQuery, [
                    periodePaie,
                    startDate.format('YYYY-MM-DD'),
                    endDate.format('YYYY-MM-DD'),
                    employee.attendance_id
                ]);

                await client.query('COMMIT');
                console.log(`✓ ${empId.padEnd(6)} | ${empName.padEnd(20)} | ${rowCount.toString().padStart(3)} pointages mis à jour`);
                
            } catch (error) {
                await client.query('ROLLBACK');
                const empId = employee.attendance_id?.toString() || 'ID inconnu';
                console.error(`✗ Erreur pour ${empId}:`, error.message);
            }
        }

        console.log(`✅ Période de paie ${periodePaie} initialisée avec succès`);
        console.log(`   - ${employees.length} fiches monthly_attendance mises à jour`);
        
    } catch (error) {
        console.error("❌ Erreur globale:", error);
        throw error;
    } finally {
        client.release();
    }
}
// Fonction pour remplir monthly_attendance avec les données de week_attendance (A TESTER)
async function update_monthly_attendance() {
    const client = await pool.connect();
    try {
        console.log("🔄 Mise à jour des totaux mensuels");

        // Requête d'insertion/mise à jour

        const query = `
        INSERT INTO monthly_attendance (
            employee_id, payroll_id, month_start, month_end,
            total_night_hours, total_worked_hours, total_penalisable,
            total_sup, total_sunday_hours, total_missed_hours,
            total_jf, total_jc, total_jcx, total_htjf, total_normal_trav
        )
        SELECT 
            e.attendance_id,
            e.payroll_id,

            -- month_start : 26 du mois précédent ou courant
            CASE 
                WHEN EXTRACT(DAY FROM wa.start_date) >= 26 THEN
                    DATE_TRUNC('month', wa.start_date) + INTERVAL '25 days'
                ELSE
                    DATE_TRUNC('month', wa.start_date - INTERVAL '1 month') + INTERVAL '25 days'
            END::date AS month_start,

            -- month_end : month_start + 1 mois - 1 jour
            CASE 
                WHEN EXTRACT(DAY FROM wa.start_date) >= 26 THEN
                    DATE_TRUNC('month', wa.start_date) + INTERVAL '1 month + 24 days'
                ELSE
                    DATE_TRUNC('month', wa.start_date - INTERVAL '1 month') + INTERVAL '1 month + 24 days'
            END::date AS month_end,

            -- Totaux
            COALESCE(SUM(wa.total_night_hours), 0),
            COALESCE(SUM(wa.total_worked_hours), 0),
            COALESCE(SUM(wa.total_penalisable), 0),
            COALESCE(SUM(wa.total_sup), 0),
            COALESCE(SUM(wa.total_sunday_hours), 0),
            COALESCE(SUM(wa.total_missed_hours), 0),
            COALESCE(SUM(wa.total_jf), 0),
            COALESCE(SUM(wa.total_jc), 0),
            COALESCE(SUM(wa.total_jcx), 0),
            COALESCE(SUM(wa.total_htjf), 0),
            COALESCE(SUM(wa.total_normal_trav), 0)

        FROM week_attendance wa
        JOIN employees e ON wa.employee_id = e.attendance_id

        GROUP BY 
            e.attendance_id, e.payroll_id,
            CASE 
                WHEN EXTRACT(DAY FROM wa.start_date) >= 26 THEN
                    DATE_TRUNC('month', wa.start_date) + INTERVAL '25 days'
                ELSE
                    DATE_TRUNC('month', wa.start_date - INTERVAL '1 month') + INTERVAL '25 days'
            END,
            CASE 
                WHEN EXTRACT(DAY FROM wa.start_date) >= 26 THEN
                    DATE_TRUNC('month', wa.start_date) + INTERVAL '1 month + 24 days'
                ELSE
                    DATE_TRUNC('month', wa.start_date - INTERVAL '1 month') + INTERVAL '1 month + 24 days'
            END

        ON CONFLICT (employee_id, month_start) 
        DO UPDATE SET
            payroll_id = EXCLUDED.payroll_id,
            month_end = EXCLUDED.month_end,
            total_night_hours = EXCLUDED.total_night_hours,
            total_worked_hours = EXCLUDED.total_worked_hours,
            total_penalisable = EXCLUDED.total_penalisable,
            total_sup = EXCLUDED.total_sup,
            total_sunday_hours = EXCLUDED.total_sunday_hours,
            total_missed_hours = EXCLUDED.total_missed_hours,
            total_jf = EXCLUDED.total_jf,
            total_jc = EXCLUDED.total_jc,
            total_jcx = EXCLUDED.total_jcx,
            total_htjf = EXCLUDED.total_htjf,
            total_normal_trav = EXCLUDED.total_normal_trav,
            updated_at = NOW()
        `;



        await client.query(query);
        console.log("✅ Totaux mensuels mis à jour avec succès");
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des totaux mensuels:", error);
        throw error;
    } finally {
        client.release();
    }
}


const getWeeklyAttendanceByDate = async (req, res) => {
    const { date } = req.query;
    
    try {
        const query = `
            SELECT 
                wa.*, 
                e.firstname, 
                e.lastname, 
                e.matricule,
                a.hours_worked,
                a.missed_hours,
                a.sup_hour,
                a.night_hours,
                a.sunday_hour,
                a.worked_hours_on_holidays
            FROM week_attendance wa
            JOIN employees e ON wa.employee_id = e.attendance_id
            LEFT JOIN attendance_summary a ON a.employee_id = wa.employee_id 
                AND a.date = $1
            WHERE wa.start_date <= $1 AND wa.end_date >= $1
            ORDER BY e.lastname, e.firstname
        `;
        
        const { rows } = await pool.query(query, [date]);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching daily attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des données journalières'
        });
    }
};


async function prime_assiduite() {
    const client = await pool.connect();

    try {
        console.log("🔍 Récupération des employés");
        
        // 1. Récupérer tous les employés actifs avec leur plafond
        const activeEmployees = await client.query(`
            SELECT plafond, attendance_id FROM employees WHERE is_active = TRUE
        `);

        if (activeEmployees.rows.length === 0) {
            console.log("ℹ️ Aucun employé actif trouvé");
            return;
        }

        console.log(`👥 ${activeEmployees.rows.length} employés actifs à traiter`);

        for (const emp of activeEmployees.rows) {
            // 2. Pour chaque employé, récupérer ses heures pénalisables
            const attendanceData = await client.query(`
                SELECT prime_assiduite, total_penalisable 
                FROM monthly_attendance 
                WHERE employee_id = $1
            `, [emp.attendance_id]);

            if (attendanceData.rows.length === 0) {
                console.log(`ℹ️ Aucune donnée de présence trouvée pour l'employé ${emp.attendance_id}`);
                continue;
            }

            const { total_penalisable } = attendanceData.rows[0];
            let new_prime_assiduite = 0;

            // 3. Logique de calcul de la prime Assiduité
            if (total_penalisable > 10 || emp.plafond == 0) {
                new_prime_assiduite = 0; // si sup à 10 ou pas de plafond alors PA = 0
            } else if (total_penalisable > 9) {
                new_prime_assiduite = emp.plafond / 4;
            } else if (total_penalisable > 3) {
                new_prime_assiduite = emp.plafond / 3;
            } else if (total_penalisable > 0) {
                new_prime_assiduite = emp.plafond / 2;
            } else {
                // Si total_penalisable = 0, prime = plafond complet
                new_prime_assiduite = emp.plafond;
            }

            // 4. Mettre à jour la prime d'assiduité
            await client.query(`
                UPDATE monthly_attendance 
                SET prime_assiduite = $1 
                WHERE employee_id = $2
            `, [new_prime_assiduite, emp.attendance_id]);

            console.log(`🔄 Employé ${emp.attendance_id}: prime mise à jour à ${new_prime_assiduite} (heures pénalisables: ${total_penalisable})`);
        }

        console.log('✅ Traitement terminé pour tous les employés');
    } catch (error) {
        console.error('❌ Erreur globale du traitement:', error);
        throw error;
    } finally {
        client.release();
    }
}



// Fonction pour traiter les pointages POUR UN EMPLOYEE A UNE DATE donnée
async function process() {
    // Constants for business rules
    const REGULAR_SHIFT_START_MINUTES = 4 * 60; // 4:00 AM (04:00)
    const REGULAR_SHIFT_END_MINUTES = 21 * 60; // 9:00 PM (21:00)
    const MIN_WORK_HOURS = 0;
    const HOURS_PRECISION = 2;
    const employeeId = 1589;
    const date = '2025-08-02';

    // Date calculations
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    const endDate = new Date(targetDate);
    startDate.setDate(targetDate.getDate() - 2);
    endDate.setDate(targetDate.getDate() - 1);

    await initAttendanceSummary(employeeId, date);  // création de l'Attendance summary

    if (!Number.isInteger(Number(employeeId))) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }

    const client = await pool.connect();
    try {
        console.log(`🌞 Calcul de pointage de employee de Matricule: ${employeeId} à la date ${date}`);

        // 1. Fetch all regular shifts
        const regularShiftsQuery = `
        WITH ordered_punches AS (
            SELECT 
                id, 
                employee_id, 
                punch_time, 
                punch_type,
                DATE(punch_time) AS punch_date,
                EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) AS minutes_in_day
            FROM attendance_records
            WHERE employee_id = $1
              AND DATE(punch_time) BETWEEN $4::date AND $5::date
              AND (EXTRACT(HOUR FROM punch_time) * 60 + EXTRACT(MINUTE FROM punch_time) 
                   BETWEEN $2 AND $3)
        )
        SELECT 
            punch_time,
            punch_type,
            punch_date
        FROM ordered_punches
        ORDER BY punch_time
        `;

        const shifts = await client.query(regularShiftsQuery, [
            employeeId,
            REGULAR_SHIFT_START_MINUTES,
            REGULAR_SHIFT_END_MINUTES,
            startDate,
            endDate
        ]);

        // Group shifts by date
        const shiftsByDate = {};
        shifts.rows.forEach(shift => {
            const dateKey = shift.punch_date.toISOString().split('T')[0];
            if (!shiftsByDate[dateKey]) {
                shiftsByDate[dateKey] = [];
            }
            shiftsByDate[dateKey].push(shift);
        });

        // Process each day
        for (const [dateKey, dayShifts] of Object.entries(shiftsByDate)) {
            try {
                // Get all punches for the day
                const allPunchesQuery = `
                    SELECT 
                        punch_time,
                        punch_type
                    FROM attendance_records
                    WHERE employee_id = $1
                      AND DATE(punch_time) = $2
                    ORDER BY punch_time;
                `;
                const allPunches = await client.query(allPunchesQuery, [employeeId, dateKey]);

                // Initialize variables
                let getin = null;
                let getout = null;
                let autoriz_getin = null;
                let autoriz_getout = null;
                let workedHours = 0;

                // Process punches
                if (allPunches.rows.length >= 2) {
                    // First IN is getin
                    const firstIn = allPunches.rows.find(p => p.punch_type === 'IN');
                    if (firstIn) getin = formatTime(firstIn.punch_time);

                    // Last OUT is getout
                    const lastOut = [...allPunches.rows].reverse().find(p => p.punch_type === 'OUT');
                    if (lastOut) getout = formatTime(lastOut.punch_time);

                    // Special case: exactly 4 punches
                    if (allPunches.rows.length === 4 && 
                        allPunches.rows[0].punch_type === 'IN' &&
                        allPunches.rows[1].punch_type === 'OUT' &&
                        allPunches.rows[2].punch_type === 'IN' &&
                        allPunches.rows[3].punch_type === 'OUT') {
                        
                        autoriz_getout = formatTime(allPunches.rows[1].punch_time);
                        autoriz_getin = formatTime(allPunches.rows[2].punch_time);
                    }
                    // General case: multiple punches
                    else if (allPunches.rows.length > 2) {
                        const inIndexes = allPunches.rows
                            .map((p, i) => p.punch_type === 'IN' ? i : -1)
                            .filter(i => i !== -1);
                        
                        const outIndexes = allPunches.rows
                            .map((p, i) => p.punch_type === 'OUT' ? i : -1)
                            .filter(i => i !== -1);

                        if (inIndexes.length > 0 && outIndexes.length > 0) {
                            // First OUT after first IN is autoriz_getout
                            const firstOutAfterFirstIn = outIndexes.find(oi => oi > inIndexes[0]);
                            if (firstOutAfterFirstIn !== undefined) {
                                autoriz_getout = formatTime(allPunches.rows[firstOutAfterFirstIn].punch_time);
                            }

                            // Last IN before last OUT is autoriz_getin
                            const lastInBeforeLastOut = [...inIndexes]
                                .reverse()
                                .find(ii => ii < outIndexes[outIndexes.length - 1]);
                            if (lastInBeforeLastOut !== undefined) {
                                autoriz_getin = formatTime(allPunches.rows[lastInBeforeLastOut].punch_time);
                            }
                        }
                    }

                    // Calculate worked hours
                    if (getin && getout) {
                        workedHours = (new Date(`1970-01-01T${getout}:00`) - 
                                     new Date(`1970-01-01T${getin}:00`)) / 3600000;

                        // Subtract authorization period if exists
                        if (autoriz_getin && autoriz_getout) {
                            const authDuration = (new Date(`1970-01-01T${autoriz_getin}:00`) - 
                                              new Date(`1970-01-01T${autoriz_getout}:00`)) / 3600000;
                            workedHours = Math.max(workedHours - authDuration, MIN_WORK_HOURS);
                        }
                    }
                }

                // Get shift summary data
                const summaryQuery = `
                    SELECT 
                        getin_ref, 
                        getout_ref,
                        break_duration
                    FROM attendance_summary
                    WHERE employee_id = $1 
                      AND date = $2
                      AND isholidays = FALSE 
                      AND is_conge = FALSE 
                      AND islayoff = FALSE
                    LIMIT 1;
                `;
                const summaryResult = await client.query(summaryQuery, [employeeId, dateKey]);
                
                if (summaryResult.rows.length === 0) continue;
                
                const summary = summaryResult.rows[0];
                const getin_ref = formatTime(summary.getin_ref);
                const getout_ref = formatTime(summary.getout_ref);
                const breakDuration = parseFloat(summary.break_duration) || 0;

                // Subtract break   
                workedHours = parseFloat(
                    Math.max(workedHours - breakDuration, MIN_WORK_HOURS).toFixed(HOURS_PRECISION)
                );
                const is_missing = (getin == null && getout == null)
                
                // Vérifie si le nombre de pointages est impair (indiquant une anomalie)
                const is_anomalie = allPunches.rows.length % 2 !== 0;


                // Update attendance summary
                await client.query(`
                    UPDATE attendance_summary
                    SET 
                        getin = $3::TIME,
                        getout = $4::TIME,
                        autoriz_getin = $5::TIME,
                        autoriz_getout = $6::TIME,
                        is_anomalie = $8,
                        hours_worked = CASE
                            WHEN is_sunday THEN 0
                            ELSE $7::NUMERIC
                        END,
                        status = CASE
                            WHEN ($7::NUMERIC = 0) AND is_anomalie = FALSE  THEN 'absent'
                            WHEN getin_ref IS NULL THEN 'present'
                            WHEN $3::TIME <= getin_ref THEN 'present'
                            ELSE 'retard'
                        END,
                        get_holiday = CASE
                            WHEN $3 IS NULL THEN FALSE
                            WHEN getin_ref IS NULL THEN TRUE
                            ELSE TRUE
                        END,
                        nbr_retard = CASE
                            WHEN $3::TIME <= getin_ref THEN 0
                            WHEN $3::TIME > getin_ref THEN 1
                        END,  
                        nbr_absence = CASE
                            WHEN $9 IS TRUE THEN 1
                            ELSE 0
                        END, 
                        nbr_depanti = CASE
                            WHEN $4::TIME < getout_ref THEN 1
                            ELSE 0
                        END,
                        sunday_hour = CASE
                        WHEN is_sunday = TRUE THEN $7::NUMERIC
                        ELSE 0
                        END,
                        sup_hour = CASE
                        WHEN is_saturday = TRUE AND getin_ref is NULL THEN $7::NUMERIC
                        ELSE GREATEST($7::NUMERIC - normal_hours::NUMERIC, 0 )
                        END,
                        missed_hour = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        penalisable = GREATEST(COALESCE(normal_hours::NUMERIC, 0) - COALESCE(hours_worked::NUMERIC, 0), 0 ),
                        updated_at = NOW()
                    WHERE employee_id = $1 AND date = $2
                  ;
                `, [
                    employeeId,     //$1
                    dateKey,        //$2
                    getin,          //$3
                    getout,         //$4
                    autoriz_getin,  //$5
                    autoriz_getout, //$6
                    workedHours,    //$7
                    is_anomalie,    //$8
                    is_missing       //$9
                ]);

            } catch (dayError) {
                console.error(`❌ Error processing day ${dateKey}:`, dayError.message);
                continue;
            }
        }

        console.log(`✅ Completed processing for employee ${employeeId}`);
    } catch (error) {
        console.error(`❌ Critical error processing employee ${employeeId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }

    function formatTime(dateTime) {
        if (!dateTime || isNaN(new Date(dateTime).getTime())) return null;
        const d = new Date(dateTime);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}



module.exports = { 
    downloadAttendance, 
    processAllAttendances, 
    processEmployeeAttendance,
    updateAttendanceSummary,
    processRegularShifts,
    classifyAllPunchesWithLogs,
    processAllNightShifts,
    processMonthlyAttendance,
    init_week_attendance,
    update_week_attendance,
    update_monthly_attendance,
    init_month_attendance,
    verifyAndFixPunchSequence,
    processManualAttendance,
    updateAttendanceSummaryFromTimes,
    apresAjoutIndisponibility,
    prime_assiduite,
    process,
    employeeUnvailable,
    deletAttendanceSummary
};
