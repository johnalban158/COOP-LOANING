use crate::models::*;
use reqwest::Client;
use serde_json::json;

// ─── Nemotron 3.5 Super VL Backend Integration ─────────────────────────

pub fn nemotron_chat_impl(input: NemotronChatInput) -> ApiResponse<NemotronChatResponse> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(nemotron_chat_async(input))
    })
}

async fn nemotron_chat_async(input: NemotronChatInput) -> ApiResponse<NemotronChatResponse> {
    let api_key = std::env::var("NEMOTRON_API_KEY").unwrap_or_default();
    let api_url = std::env::var("NEMOTRON_API_URL").unwrap_or_else(|_| "https://integrate.api.nvidia.com/v1/chat/completions".to_string());
    let model = std::env::var("NEMOTRON_MODEL").unwrap_or_else(|_| "nvidia/nemotron-3-5-super-vl".to_string());

    if api_key.is_empty() {
        // Return a mock response for development
        return ApiResponse::ok(NemotronChatResponse {
            response: format!(
                "[Nemotron 3.5 Super VL - Development Mode]\n\nI received your message: \"{}\"\n\nNote: To use the real Nemotron 3.5 Super VL backend, set the NEMOTRON_API_KEY environment variable with your NVIDIA NIM API key.\n\nI can help you with:\n- Loan application analysis\n- Member document review\n- Payment verification\n- Cooperative policy guidance\n- Financial calculations",
                input.message
            ),
            model: model.clone(),
            usage: None,
        });
    }

    let client = Client::new();
    let system_prompt = input.system_prompt.unwrap_or_else(|| {
        "You are an AI assistant for CampusCoop, a cooperative loan management system for SKSU. You help with loan applications, member management, payment processing, and cooperative policies. Respond in a helpful, professional manner using Philippine Peso (₱) formatting when discussing amounts.".to_string()
    });

    let mut messages = vec![json!({ "role": "system", "content": system_prompt })];

    if let Some(image_url) = &input.image_url {
        // VL capability - image + text
        messages.push(json!({
            "role": "user",
            "content": [
                { "type": "text", "text": input.message },
                { "type": "image_url", "image_url": { "url": image_url } }
            ]
        }));
    } else {
        messages.push(json!({ "role": "user", "content": input.message }));
    }

    let request = json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
        "stream": false
    });

    match client.post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                let result: serde_json::Value = resp.json().await.unwrap_or_default();
                let response_text = result.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("No response from Nemotron")
                    .to_string();

                let usage = result.get("usage").cloned();

                ApiResponse::ok(NemotronChatResponse {
                    response: response_text,
                    model,
                    usage,
                })
            } else {
                let error_text = resp.text().await.unwrap_or_default();
                ApiResponse::err(&format!("Nemotron API error: {}", error_text))
            }
        }
        Err(e) => ApiResponse::err(&format!("Nemotron request failed: {}", e)),
    }
}

pub fn nemotron_analyze_document_impl(document_text: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(nemotron_analyze_document_async(document_text))
    })
}

async fn nemotron_analyze_document_async(document_text: String) -> ApiResponse<serde_json::Value> {
    let api_key = std::env::var("NEMOTRON_API_KEY").unwrap_or_default();
    let api_url = std::env::var("NEMOTRON_API_URL").unwrap_or_else(|_| "https://integrate.api.nvidia.com/v1/chat/completions".to_string());
    let model = std::env::var("NEMOTRON_MODEL").unwrap_or_else(|_| "nvidia/nemotron-3-5-super-vl".to_string());

    let prompt = format!(
        "Analyze the following cooperative loan document and extract key information:\n\n---\n{}\n---\n\nPlease provide:\n1. Document type (loan application, payment receipt, member profile, etc.)\n2. Key entities (member name, ID, amounts, dates)\n3. Financial figures (loan amount, monthly payment, balance)\n4. Status (pending, approved, released, paid)\n5. Recommended actions\n6. Any discrepancies or issues found\n\nRespond in JSON format.",
        document_text
    );

    if api_key.is_empty() {
        return ApiResponse::ok(json!({
            "analysis": "[Nemotron 3.5 Super VL - Development Mode]\nDocument analysis requires API key. Set NEMOTRON_API_KEY environment variable.\n\nDocument preview: {}",
            "model": model,
            "documentText": document_text,
            "extracted": {
                "documentType": "unknown",
                "entities": [],
                "financials": {},
                "status": "unknown",
                "recommendations": ["Configure NEMOTRON_API_KEY for real analysis"],
                "discrepancies": []
            }
        }));
    }

    let client = Client::new();
    let request = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "You are a document analysis AI for cooperative loan systems. Extract structured information from documents." },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
        "stream": false
    });

    match client.post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                let result: serde_json::Value = resp.json().await.unwrap_or_default();
                let response_text = result.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("No response")
                    .to_string();

                ApiResponse::ok(json!({
                    "analysis": response_text,
                    "model": model,
                    "documentText": document_text
                }))
            } else {
                let error_text = resp.text().await.unwrap_or_default();
                ApiResponse::err(&format!("Nemotron analysis error: {}", error_text))
            }
        }
        Err(e) => ApiResponse::err(&format!("Nemotron analysis request failed: {}", e)),
    }
}

pub fn nemotron_loan_recommendation_impl(input: NemotronLoanRecommendationInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(nemotron_loan_recommendation_async(input))
    })
}

async fn nemotron_loan_recommendation_async(input: NemotronLoanRecommendationInput) -> ApiResponse<serde_json::Value> {
    let api_key = std::env::var("NEMOTRON_API_KEY").unwrap_or_default();
    let api_url = std::env::var("NEMOTRON_API_URL").unwrap_or_else(|_| "https://integrate.api.nvidia.com/v1/chat/completions".to_string());
    let model = std::env::var("NEMOTRON_MODEL").unwrap_or_else(|_| "nvidia/nemotron-3-5-super-vl".to_string());

    let existing_balance: f64 = input.existing_loans.iter().map(|l| l.balance).sum();
    let active_loans_count = input.existing_loans.iter().filter(|l| l.status == "Active").count();

    // CBU-based calculation (ported from Apps Script logic)
    let (reg_pct, st_pct, com_pct) = (300.0, 80.0, 80.0);
    let applicable_pct = match input.loan_type.as_str() {
        "Regular" => reg_pct,
        "Commodity" => com_pct,
        _ => {
            let member_type = input.member_type.to_lowercase();
            if member_type == "teacher" { reg_pct } else { st_pct }
        }
    };
    let max_loanable = (input.member_capital * applicable_pct / 100.0).round();
    let within_limit = input.requested_amount <= max_loanable;

    // Payment calculation
    let (monthly, total_payable) = match input.loan_type.as_str() {
        "Regular" => {
            let prin = input.requested_amount / input.term as f64;
            let int1 = input.requested_amount * 0.01;
            ((prin + int1).round(), input.requested_amount)
        }
        "Commodity" => {
            let total = (input.requested_amount * (1.0 + 0.01 * input.term as f64)).round();
            (total / input.term as f64, total)
        }
        _ => {
            let total = (input.requested_amount * 1.06).round();
            (total / input.term as f64, total)
        }
    };

    let recommendation = if !within_limit {
        format!("NOT RECOMMENDED: Requested amount ₱{} exceeds CBU maximum of ₱{} ({}% of capital ₱{}). Reduce amount or increase capital.", 
            input.requested_amount.to_locale_string(), max_loanable.to_locale_string(), applicable_pct, input.member_capital)
    } else if active_loans_count >= 3 {
        format!("CAUTION: Member already has {} active loans. Consider consolidating before approving new loan.", active_loans_count)
    } else {
        format!("RECOMMENDED: Loan of ₱{} over {} months at ₱{}/month is within CBU limits (max ₱{}). Total payable: ₱{}.",
            input.requested_amount.to_locale_string(), input.term, monthly.to_locale_string(), max_loanable.to_locale_string(), total_payable.to_locale_string())
    };

    if api_key.is_empty() {
        return ApiResponse::ok(json!({
            "recommendation": recommendation,
            "model": model,
            "developmentMode": true,
            "calculations": {
                "maxLoanable": max_loanable,
                "withinLimit": within_limit,
                "monthlyPayment": monthly,
                "totalPayable": total_payable,
                "activeLoans": active_loans_count,
                "existingBalance": existing_balance
            },
            "cbuFactors": {
                "regular": reg_pct,
                "shortTerm": st_pct,
                "commodity": com_pct
            }
        }));
    }

    let client = Client::new();
    let prompt = format!(
        "As a cooperative loan officer AI, evaluate this loan request:\n\nMember Capital (CBU): ₱{}\nMember Type: {}\nLoan Type: {}\nRequested Amount: ₱{}\nTerm: {} months\nExisting Active Loans: {}\nExisting Balance: ₱{}\n\nCBU Limits: Regular {}%, Short Term {}%, Commodity {}%\n\nProvide a recommendation (approve/decline/caution) with reasoning, suggested amount, and risk assessment.",
        input.member_capital.to_locale_string(),
        input.member_type,
        input.loan_type,
        input.requested_amount.to_locale_string(),
        input.term,
        active_loans_count,
        existing_balance.to_locale_string(),
        reg_pct, st_pct, com_pct
    );

    let request = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "You are a loan recommendation AI for a cooperative system. Evaluate loan requests based on CBU limits, existing debt, and risk factors." },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
        "stream": false
    });

    match client.post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                let result: serde_json::Value = resp.json().await.unwrap_or_default();
                let response_text = result.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("No response")
                    .to_string();

                ApiResponse::ok(json!({
                    "recommendation": response_text,
                    "model": model,
                    "calculations": {
                        "maxLoanable": max_loanable,
                        "withinLimit": within_limit,
                        "monthlyPayment": monthly,
                        "totalPayable": total_payable,
                        "activeLoans": active_loans_count,
                        "existingBalance": existing_balance
                    }
                }))
            } else {
                let error_text = resp.text().await.unwrap_or_default();
                ApiResponse::err(&format!("Nemotron recommendation error: {}", error_text))
            }
        }
        Err(e) => ApiResponse::err(&format!("Nemotron recommendation request failed: {}", e)),
    }
}

trait ToLocaleString {
    fn to_locale_string(&self) -> String;
}

impl ToLocaleString for f64 {
    fn to_locale_string(&self) -> String {
        format!("{:.2}", self)
    }
}
