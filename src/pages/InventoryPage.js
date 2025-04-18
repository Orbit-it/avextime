import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import "./InventoryPage.css";
import Endpoint from "../config/Endpoint";
import { io } from "socket.io-client";

Modal.setAppElement("#root");

const socket = io(Endpoint.websocket, { transports: ["websocket"] });

const InventoryPage = () => {
  const [search, setSearch] = useState("");
  const [inventoryData, setInventoryData] = useState([]);
  const [article, setArticle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showValidationIcon, setShowValidationIcon] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await fetch(Endpoint.inventory);
        if (!response.ok) throw new Error("Erreur lors du chargement des articles.");
        const data = await response.json();
        setInventoryData(data);
      } catch (error) {
        console.error("Erreur:", error);
      }
    };

    fetchInventory();

    socket.on("inventoryUpdated", (updatedArticle) => {
      setInventoryData((prevData) =>
        prevData.map((item) => (item.id === updatedArticle.id ? updatedArticle : item))
      );
      if (article && article.id === updatedArticle.id) {
        setArticle(updatedArticle);
      }
    });

    return () => {
      socket.off("inventoryUpdated");
    };
  }, [article]);

  const handleValidation = () => {
    if (!article) return;
    if (article.nouvelle_qte === null || article.nouvelle_qte === undefined) {
      setIsModalOpen(true);
    } else {
      setShowValidationIcon(true);
      setTimeout(() => setShowValidationIcon(false), 2000);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearch(query);
    const foundArticle = inventoryData.find((item) =>
      item.ref_interne?.toLowerCase().includes(query) || item.designation?.toLowerCase().includes(query)
    );
    setArticle(foundArticle || null);
  };

  const handleUpdate = async (field, value) => {
    if (!article) return;
    const updatedArticle = { ...article, [field]: value };
    setArticle(updatedArticle);
    try {
      const response = await fetch(`http://localhost:5000/api/inventory/update/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Erreur lors de la mise à jour de l'article.");
      const updatedData = await response.json();
      socket.emit("updateInventory", updatedData);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleConfirm = () => {
    handleUpdate("nouvelle_qte", article.qte_pre_inventaire);
    setIsModalOpen(false);
  };

  return (
    <div className="inventory-page">
      <input
        type="text"
        placeholder="Scanner le code-barres..."
        value={search}
        onChange={handleSearch}
        className="search-bar"
      />
      {article ? (
        <div className={`article-details ${article.base_from === "pre-inventaire" && article.nouvelle_qte === null ? "highlight-red" : article.nouvelle_qte !== null ? "highlight-green" : ""}`}>
          <p><strong>Réf. Interne :</strong> {article.ref_interne}</p> 
          <p><strong>Réf. Fournisseur :</strong> {article.ref_fourn}</p>
          <p><strong>Désignation :</strong> {article.designation}</p>
          <p><strong>Fournisseur :</strong> {article.fournisseur}</p>
          <div className="price-fields">
            <p><strong>Prix :</strong>
              <input
                type="number"
                value={article.prix ?? ""}
                onChange={(e) => handleUpdate("prix", e.target.value === "" ? null : parseFloat(e.target.value))}
              />
              <select
                value={article.devise || "default"}
                onChange={(e) => handleUpdate("devise", e.target.value)}
              >
                <option value="default" disabled>{article.devise || "Devise"}</option>
                <option value="TND">TND</option>
                <option value="€">€</option>
              </select>
            </p>
          </div>
          <p><strong>Quantité :</strong>
              <input 
                type="number"
                value={article.nouvelle_qte !== null && article.nouvelle_qte !== undefined ? article.nouvelle_qte : ""}
                onChange={(e) => handleUpdate("nouvelle_qte", e.target.value === "" ? null : parseFloat(e.target.value))}
              />
            </p>

          {article.is_commun ? (
            <div className="composite-fields">
              <p>
                <strong>Qté Composite :</strong>
                <input
                  type="number"
                  value={article.qte_composite}
                  onChange={(e) =>
                    handleUpdate(
                      "qte_composite",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )
                  }
                />
                <strong> Zone Composite :</strong>
                <input
                  type="text"
                  value={article.zone_composite}
                  onChange={(e) =>
                    handleUpdate("zone_composite", e.target.value)
                  }
                />
              </p>
            </div>
          ) : null}

          <div className="emplacement-fields">
            <p><strong>Zone</strong></p>
            <input
              type="text"
              placeholder="Zone"
              value={article.zone || ""}
              onChange={(e) => handleUpdate("zone", e.target.value)}
            />
            <p><strong>Allée</strong></p>
            <input
              type="text"
              placeholder="Allée"
              value={article.allee || ""}
              onChange={(e) => handleUpdate("allee", e.target.value)}
            />
            <p><strong>Bloc</strong></p>
            <input
              type="text"
              placeholder="Bloc"
              value={article.bloc || ""}
              onChange={(e) => handleUpdate("bloc", e.target.value)}
            />
            <p><strong>Niveau</strong></p>
            <input
              type="text"
              placeholder="Niveau"
              value={article.niveau || ""}
              onChange={(e) => handleUpdate("niveau", e.target.value)}
            />
          </div>
          <button className="validate-button" onClick={handleValidation}>
            Valider
          </button>
        </div>
      ) : (
        <div className="article-details">
        <p><strong> AUCUN ARTICLE TROUVER POUR : {search} </strong></p>
        </div>
      )}

       {/* Icône de validation */}
       {showValidationIcon && (
        <div className="validation-icon">
          <i className="fas fa-check-circle"></i>
          Article inventorié !
        </div>
      
      )}

      {/* Modal de confirmation */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Confirmer la quantité"
        className="modal"
      >
        <h2>Quantité manquante</h2>
        <h2>Confirmez-vous la quantité 0 pour cet article ?</h2>
        <button onClick={handleConfirm}>Oui</button>
        <button onClick={() => setIsModalOpen(false)}>Annuler</button>
      </Modal>
    </div>
  );
};

export default InventoryPage;
