use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationData {
    pub attestation_number: String,
    pub date_verification: String,
    pub immatriculation: String,
    pub date_effet: String,
    pub date_echeance: String,
    pub marque: String,
    pub modele: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResponse {
    pub operation_status: String,
    pub operation_message: String,
    pub data: Option<VerificationData>,
}

#[tauri::command]
pub async fn verify_contract(immatriculation: String) -> Result<VerificationResponse, String> {
    let normalized = immatriculation
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();

    if normalized.is_empty() {
        return Err("Immatriculation invalide.".to_string());
    }

    let url = format!(
        "https://apiaas.diotali.com/applicationtiers/verify/{}",
        normalized
    );

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Erreur API: HTTP {}", response.status()));
    }

    response
        .json::<VerificationResponse>()
        .await
        .map_err(|e| format!("Réponse API invalide: {e}"))
}

const AAS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

// Sous-ensemble utile de la souscription AAS : serde ignore les champs non
// déclarés (secureKey, qrCodeValue, arborescence de la compagnie...).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionAssure {
    pub immatriculation: Option<String>,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub category: Option<String>,
    pub carburant: Option<String>,
    pub puissance_fiscale: Option<f64>,
    pub nombre_place: Option<f64>,
    pub date_mise_circulation: Option<String>,
    pub valeur_neuve: Option<f64>,
    pub valeur_actuelle: Option<f64>,
    pub vin: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionPeriode {
    pub date_effet: Option<String>,
    pub date_expiration: Option<String>,
    pub duree: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionBeneficiaire {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub cellulaire: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionContact {
    pub cellulaire: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub fixe: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionCompagnie {
    pub libelle: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionData {
    pub attestation_number: String,
    pub police: Option<String>,
    pub date_souscription: Option<String>,
    pub assure: Option<SouscriptionAssure>,
    pub periode_couverture: Option<SouscriptionPeriode>,
    pub beneficiaire: Option<SouscriptionBeneficiaire>,
    pub contact: Option<SouscriptionContact>,
    pub compagnie: Option<SouscriptionCompagnie>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SouscriptionResponse {
    pub operation_status: String,
    pub operation_message: String,
    pub data: Option<SouscriptionData>,
}

#[tauri::command]
pub async fn get_souscription_by_attestation(
    attestation_number: String,
) -> Result<SouscriptionResponse, String> {
    let normalized = attestation_number.trim().to_uppercase();
    if normalized.is_empty()
        || normalized.len() > 20
        || !normalized.chars().all(|c| c.is_ascii_alphanumeric())
    {
        return Err("Numéro d'attestation invalide.".to_string());
    }

    let url = format!(
        "https://apiaas.diotali.com/souscriptionauto/souscription-by-attestation-number/{}",
        normalized
    );

    let client = reqwest::Client::builder()
        .timeout(AAS_TIMEOUT)
        .build()
        .map_err(|e| format!("Erreur réseau: {e}"))?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Erreur API: HTTP {}", response.status()));
    }

    response
        .json::<SouscriptionResponse>()
        .await
        .map_err(|e| format!("Réponse API invalide: {e}"))
}
