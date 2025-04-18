import React, { useState, useEffect } from "react";
import Modal from "react-modal"; // Import de react-modal
import "./InventoryPage.css";
import Endpoint from "../links/FetchLink";

Modal.setAppElement("#root"); // Définir l'élément racine de l'application

const ListingPage = () => {
  const [search, setSearch] = useState("");
  const [inventoryData, setInventoryData] = useState([]);
  const [article, setArticle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // Ajout de l'état du modal
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
  }, []);

  const handleValidation = () => {
    if (!article) return;

    if (article.nouvelle_qte === null || article.nouvelle_qte === undefined) {
      // Ouvrir le modal de confirmation
      setIsModalOpen(true);
    } else {
       // Afficher l'icône de validation
       setShowValidationIcon(true);
       // Masquer l'icône après 2 secondes
       setTimeout(() => setShowValidationIcon(false), 2000);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value ? e.target.value.toLowerCase() : "";
    setSearch(query);
    const foundArticle = inventoryData.find((item) => {
      const refInterne = item.ref_interne ? item.ref_interne.toLowerCase() : "";
      const designation = item.designation ? item.designation.toLowerCase() : "";
      return refInterne.includes(query) || designation.includes(query);
    });
    setArticle(foundArticle || null);
  };

  const handleUpdate = async (field, value) => {
    if (!article) return;

    const updatedArticle = { ...article, [field]: value };
    setArticle(updatedArticle);

    try {
      const response = await fetch(`http://localhost:5000/api/listing/a37/update/${article.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) throw new Error("Erreur lors de la mise à jour de l'article.");

      const updatedData = await response.json();
      setInventoryData((prevData) =>
        prevData.map((item) => (item.id === article.id ? updatedData : item))
      );
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  // Fonction pour valider et fermer le modal
  const handleConfirm = () => {
    handleUpdate("nouvelle_qte", article.qte_pre_inventaire);
    setIsModalOpen(false); // Fermer le modal
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
        <div
          className={`article-details ${
            article.base_from === "pre-inventaire" && article.nouvelle_qte === null
              ? "highlight-red"
              : article.nouvelle_qte !== null
              ? "highlight-green"
              : ""
          }`}
        >
          <p><strong>Réf. Interne :</strong> {article.ref_interne}</p> 
          <p><strong>Réf. Fournisseur :</strong> {article.ref_fourn}</p>
          <p><strong>Désignation :</strong> {article.designation}</p>
          <p><strong>Fournisseur :</strong> {article.fournisseur}</p>
          <div className="price-fields">
            <p><strong>Quantité :</strong>
              <input
                type="number"
                value={article.prix !== null && article.prix !== undefined ? article.prix : ""}
                onChange={(e) => handleUpdate("prix", e.target.value === "" ? null : parseFloat(e.target.value))}
              />
              <select
                value={article.devise || "default"}
                onChange={(e) => handleUpdate("devise", e.target.value)}
              >
                <option value="default" disabled>
                  {article.devise ? `${article.devise}` : "Quel Jour ?"}
                </option>
                <option value="1">Jour 1</option>
                <option value="2">Jour 2</option>
                <option value="3">Jour 3</option>
                <option value="4">Jour 4</option>
                <option value="5">Jour 5</option>
                <option value="6">Jour 6</option>
                <option value="7">Jour 7</option>
            
              </select>
            </p>
            <p><strong>Unité :</strong>
              <input
                type="text"
                value={article.unite}
                onChange={(e) => handleUpdate("unite", e.target.value)}
              />
            </p>
          </div>

            <p><strong>Qté Pré-Inventaire :</strong>{article.qte_pre_inventaire}</p>

            <p><strong>Nouvelle Qté :</strong>
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
          Nouvelle valeur validée !
        </div>
      
      )}

      {/* Modal de confirmation */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Confirmer la quantité"
        className="modal"
      >
        <h2>CONFIRMATION</h2>
        <h2>Confirmez-vous la quantité du pré-inventaire ?</h2>
        <button onClick={handleConfirm}>Oui</button>
        <button onClick={() => setIsModalOpen(false)}>Annuler</button>
      </Modal>
    </div>
  );
};

export default ListingPage;
