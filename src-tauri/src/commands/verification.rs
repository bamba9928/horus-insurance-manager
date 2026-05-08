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
