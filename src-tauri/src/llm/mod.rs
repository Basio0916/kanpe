use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use std::env;
use std::time::Duration;

const OPENAI_MODEL: &str = "gpt-5-mini";
const ANTHROPIC_MODEL: &str = "claude-haiku-4-5";
const REQUEST_TIMEOUT_SECS: u64 = 45;
const MAX_ERROR_BODY_CHARS: usize = 500;

#[derive(Debug, Clone, Copy)]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
}

impl LlmProvider {
    pub fn from_env() -> Result<Self, String> {
        let raw = env::var("LLM_PROVIDER")
            .or_else(|_| env::var("KANPE_LLM_PROVIDER"))
            .unwrap_or_else(|_| "openai".to_string());

        match raw.trim().to_lowercase().as_str() {
            "openai" | "gpt" => Ok(Self::OpenAi),
            "anthropic" | "claude" => Ok(Self::Anthropic),
            other => Err(format!(
                "LLM_PROVIDER '{}' は未対応です。'openai' または 'anthropic' を指定してください。",
                other
            )),
        }
    }

    fn name(&self) -> &'static str {
        match self {
            Self::OpenAi => "OpenAI",
            Self::Anthropic => "Anthropic",
        }
    }

    fn model(&self) -> &'static str {
        match self {
            Self::OpenAi => OPENAI_MODEL,
            Self::Anthropic => ANTHROPIC_MODEL,
        }
    }

    fn resolve_api_key(&self) -> Result<String, String> {
        if let Ok(shared) = env::var("LLM_API_KEY") {
            let trimmed = shared.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }

        let key = match self {
            Self::OpenAi => {
                env::var("OPENAI_API_KEY").map_err(|_| "OPENAI_API_KEY が未設定です".to_string())?
            }
            Self::Anthropic => env::var("ANTHROPIC_API_KEY")
                .map_err(|_| "ANTHROPIC_API_KEY が未設定です".to_string())?,
        };
        let trimmed = key.trim();
        if trimmed.is_empty() {
            return Err(format!("{} のAPIキーが空です", self.name()));
        }
        Ok(trimmed.to_string())
    }
}

pub struct LlmRequest {
    pub system_prompt: String,
    pub user_prompt: String,
}

pub async fn generate_reply(request: LlmRequest) -> Result<String, String> {
    let provider = LlmProvider::from_env()?;
    let api_key = provider.resolve_api_key()?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client 初期化に失敗しました: {}", e))?;

    match provider {
        LlmProvider::OpenAi => {
            call_openai(
                &client,
                &api_key,
                provider.model(),
                &request.system_prompt,
                &request.user_prompt,
            )
            .await
        }
        LlmProvider::Anthropic => {
            call_anthropic(
                &client,
                &api_key,
                provider.model(),
                &request.system_prompt,
                &request.user_prompt,
            )
            .await
        }
    }
}

async fn call_openai(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": system_prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": user_prompt
                    }
                ]
            }
        ],
        "max_output_tokens": 900
    });

    let response = client
        .post("https://api.openai.com/v1/responses")
        .header(AUTHORIZATION, format!("Bearer {}", api_key))
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API リクエストに失敗しました: {}", e))?;

    let status = response.status();
    let raw = response
        .text()
        .await
        .map_err(|e| format!("OpenAI API レスポンスの読み取りに失敗しました: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "OpenAI API エラー ({}): {}",
            status,
            truncate_for_error(&raw)
        ));
    }

    let value: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("OpenAI API レスポンスJSONの解析に失敗しました: {}", e))?;

    extract_openai_text(&value).ok_or_else(|| {
        format!(
            "OpenAI API レスポンスにテキストがありません: {}",
            truncate_for_error(&raw)
        )
    })
}

async fn call_anthropic(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": 900,
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic API リクエストに失敗しました: {}", e))?;

    let status = response.status();
    let raw = response
        .text()
        .await
        .map_err(|e| format!("Anthropic API レスポンスの読み取りに失敗しました: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Anthropic API エラー ({}): {}",
            status,
            truncate_for_error(&raw)
        ));
    }

    let value: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Anthropic API レスポンスJSONの解析に失敗しました: {}", e))?;

    extract_anthropic_text(&value).ok_or_else(|| {
        format!(
            "Anthropic API レスポンスにテキストがありません: {}",
            truncate_for_error(&raw)
        )
    })
}

fn extract_openai_text(value: &Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(|v| v.as_str()) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    let mut parts: Vec<String> = Vec::new();
    if let Some(outputs) = value.get("output").and_then(|v| v.as_array()) {
        for output in outputs {
            if let Some(contents) = output.get("content").and_then(|v| v.as_array()) {
                for content in contents {
                    let is_text = content.get("type").and_then(|v| v.as_str())
                        == Some("output_text")
                        || content.get("type").and_then(|v| v.as_str()) == Some("text");
                    if !is_text {
                        continue;
                    }
                    if let Some(text) = content.get("text").and_then(|v| v.as_str()) {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            parts.push(trimmed.to_string());
                        }
                    }
                }
            }
        }
    }
    if !parts.is_empty() {
        return Some(parts.join("\n"));
    }

    if let Some(text) = value
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
    {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    None
}

fn extract_anthropic_text(value: &Value) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    if let Some(contents) = value.get("content").and_then(|v| v.as_array()) {
        for item in contents {
            if item.get("type").and_then(|v| v.as_str()) != Some("text") {
                continue;
            }
            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }
        }
    }
    if parts.is_empty() {
        return None;
    }
    Some(parts.join("\n"))
}

fn truncate_for_error(raw: &str) -> String {
    if raw.chars().count() <= MAX_ERROR_BODY_CHARS {
        return raw.to_string();
    }
    let truncated: String = raw.chars().take(MAX_ERROR_BODY_CHARS).collect();
    format!("{}...", truncated)
}
