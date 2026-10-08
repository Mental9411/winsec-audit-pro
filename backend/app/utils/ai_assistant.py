"""
AI Security Assistant backend. The user configures their own provider in
Settings - nothing is hardcoded here and no key ships with this app:

  - "ollama"     : local model via Ollama's OpenAI-compatible endpoint
                   (default http://localhost:11434), no API key needed.
  - "openai"     : any OpenAI-compatible endpoint (OpenAI itself, or a
                   compatible self-hosted/proxy server) - user supplies
                   base_url + api_key.
  - "anthropic"  : Claude API - user supplies their own api_key.

The assistant is given the latest scan's findings as context so it can
answer questions about *this* system, and is instructed to stay in a
defensive/educational register (explain findings, suggest hardening,
generate remediation scripts) - it is not a general chatbot.
"""
import json
import httpx

SYSTEM_PROMPT = """You are the AI Security Assistant embedded in Windows Security Audit Pro, \
a defensive security auditing tool. You help a system administrator or student understand \
the results of a read-only Windows security scan that already ran on their own machine.

You can:
- Explain findings, Windows services, firewall/Defender status, and password policy in plain English
- Explain relevant CVEs, MITRE ATT&CK techniques, and Windows Event IDs at a conceptual level
- Recommend hardening steps and CIS Benchmark-aligned improvements
- Generate PowerShell remediation scripts for the user's own system, and executive summaries

Stay strictly defensive and educational: you're explaining and hardening a system the user \
already has read-only visibility into, not helping attack or gain unauthorized access to anything.
If asked something unrelated to this system's security posture, gently steer back on topic.
"""


class AIError(Exception):
    pass


def build_context_message(scan: dict) -> str:
    if not scan:
        return "No scan has been run yet - no system context is available."
    findings = json.loads(scan.get("findings_json") or "[]")
    results = json.loads(scan.get("results_json") or "{}")
    sysinfo = results.get("system_info", {}).get("data", {})
    lines = [
        f"Current scan: {scan.get('scan_type')} scan, overall score {scan.get('overall_score')}/100 "
        f"({scan.get('overall_label')}).",
        f"Host: {sysinfo.get('hostname', 'unknown')} | OS: {sysinfo.get('os_name', 'unknown')}",
        f"Findings ({len(findings)}):",
    ]
    for f in findings[:40]:
        lines.append(f"- [{f['severity'].upper()}] ({f['module']}) {f['title']}: {f['description']}")
    return "\n".join(lines)


async def chat(provider: str, config: dict, messages: list, scan_context: str) -> str:
    """messages: [{role: 'user'|'assistant', content: str}, ...] (history, no system msg)"""
    full_messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\nCurrent system context:\n" + scan_context},
        *messages,
    ]

    if provider == "ollama":
        base_url = config.get("base_url", "http://localhost:11434")
        model = config.get("model", "llama3")
        try:
            return await _chat_openai_compatible(f"{base_url}/v1/chat/completions", None, model, full_messages)
        except AIError as e:
            raise AIError(
                f"Couldn't reach Ollama at {base_url}. Make sure Ollama is installed and running "
                f"(https://ollama.com), and that you've pulled a model, e.g. `ollama pull {model}`. "
                f"Or switch to OpenAI/Anthropic in Settings if you'd rather use a hosted provider. "
                f"(Details: {e})"
            ) from e

    if provider == "openai":
        base_url = config.get("base_url", "https://api.openai.com")
        api_key = config.get("api_key")
        model = config.get("model", "gpt-4o-mini")
        if not api_key:
            raise AIError("No API key configured for this provider yet. Add one in Settings → AI Assistant Configuration.")
        return await _chat_openai_compatible(f"{base_url}/v1/chat/completions", api_key, model, full_messages)

    if provider == "anthropic":
        api_key = config.get("api_key")
        model = config.get("model", "claude-sonnet-4-6")
        if not api_key:
            raise AIError("No Anthropic API key configured yet. Add one in Settings → AI Assistant Configuration.")
        return await _chat_anthropic(api_key, model, full_messages)

    raise AIError(f"Unknown AI provider: {provider}")


async def check_status(provider: str, config: dict) -> dict:
    """Lightweight connectivity check used by the Settings 'Test Connection'
    button and the AI Assistant page banner - doesn't spend a real chat
    completion, just confirms the endpoint is reachable/authenticated."""
    try:
        if provider == "ollama":
            base_url = config.get("base_url", "http://localhost:11434")
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get(f"{base_url}/api/tags")
                res.raise_for_status()
            return {"available": True, "message": f"Connected to Ollama at {base_url}."}

        if provider == "openai":
            base_url = config.get("base_url", "https://api.openai.com")
            api_key = config.get("api_key")
            if not api_key:
                return {"available": False, "message": "No API key configured yet."}
            headers = {"Authorization": f"Bearer {api_key}"}
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get(f"{base_url}/v1/models", headers=headers)
                res.raise_for_status()
            return {"available": True, "message": f"Connected to {base_url}."}

        if provider == "anthropic":
            api_key = config.get("api_key")
            if not api_key:
                return {"available": False, "message": "No Anthropic API key configured yet."}
            headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
            payload = {"model": config.get("model", "claude-sonnet-4-6"), "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                if res.status_code >= 500:
                    res.raise_for_status()
                if res.status_code == 401:
                    return {"available": False, "message": "Anthropic rejected the API key (401 Unauthorized)."}
            return {"available": True, "message": "Connected to the Anthropic API."}

        return {"available": False, "message": f"Unknown provider: {provider}"}
    except httpx.HTTPStatusError as e:
        return {"available": False, "message": f"Provider returned {e.response.status_code}: {e.response.text[:200]}"}
    except httpx.RequestError as e:
        return {"available": False, "message": f"Could not reach the provider: {e}"}


async def _chat_openai_compatible(url: str, api_key, model: str, messages: list) -> str:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model, "messages": messages, "temperature": 0.3}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise AIError(f"AI provider returned {e.response.status_code}: {e.response.text[:300]}") from e
    except httpx.RequestError as e:
        raise AIError(f"Could not reach AI provider at {url}: {e}") from e


async def _chat_anthropic(api_key: str, model: str, messages: list) -> str:
    system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
    convo = [m for m in messages if m["role"] != "system"]
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {"model": model, "max_tokens": 1500, "system": system, "messages": convo}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    except httpx.HTTPStatusError as e:
        raise AIError(f"Anthropic API returned {e.response.status_code}: {e.response.text[:300]}") from e
    except httpx.RequestError as e:
        raise AIError(f"Could not reach Anthropic API: {e}") from e
