use sha2::{Digest, Sha256};

pub fn hash_api_key(api_key: &str) -> String {
    let digest = Sha256::digest(api_key.as_bytes());
    hex::encode(digest)
}

pub fn hash_prefix(hash: &str) -> String {
    hash.chars().take(12).collect()
}

pub fn parse_bearer_token(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .filter(|token| !token.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bearer_token() {
        assert_eq!(parse_bearer_token("Bearer abc"), Some("abc"));
        assert_eq!(parse_bearer_token("bearer abc"), Some("abc"));
        assert_eq!(parse_bearer_token("abc"), None);
    }

    #[test]
    fn hashes_are_stable() {
        assert_eq!(
            hash_api_key("local-internal-key"),
            "60a2286a5007c8e4c2664246e14f73936f55b0b96b4652933d90e21b2fa068b8"
        );
    }
}
