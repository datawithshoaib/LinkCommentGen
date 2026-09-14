# linkedin_comment_generator.py
import os
import json
import re
import requests
import streamlit as st
from streamlit.components.v1 import html
from typing import List
from dotenv import load_dotenv
import pyperclip

# ---------------------------
# Load environment variables
# ---------------------------
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

AVAILABLE_MODELS = [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "deepseek/deepseek-chat-v3.1:free",
    "google/gemma-3n-e2b-it:free",
]

TONES = ["Professional", "Friendly", "Supportive", "Engaging", "Enthusiastic", "Curious"]
LENGTHS = ["Short", "Medium", "Long"]
COMMENT_COUNTS = [4, 5]

# ---------------------------
# Helper functions
# ---------------------------
def build_prompt(post_text: str, tone: str, length_level: str, num_comments: int) -> str:
    return (
        "You are an assistant that writes short, natural, human-like LinkedIn comments.\n\n"
        f"- Produce exactly {num_comments} unique comments.\n"
        f"- Tone: {tone}.\n"
        f"- Length: {length_level}.\n"
        "- Avoid sounding like an AI; keep comments conversational, specific, and natural.\n"
        "- Only output the comments, no explanations or extra text.\n\n"
        f"Post text:\n\"\"\"\n{post_text.strip()}\n\"\"\"\n\n"
        "Write the comments now."
    )

def call_openrouter(prompt: str, model: str, max_tokens: int = 400) -> str:
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not found in .env")
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that writes natural LinkedIn comments."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.8,
    }
    resp = requests.post(OPENROUTER_ENDPOINT, headers=headers, data=json.dumps(payload), timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"OpenRouter API returned {resp.status_code}: {resp.text}")
    data = resp.json()
    return data["choices"][0]["message"]["content"]

def split_comments(raw_output: str, expected: int = 4) -> List[str]:
    txt = raw_output.strip()
    parts = re.split(r'\n\s*\d[\)\.\-]\s+', '\n' + txt)
    if len(parts) > 1:
        comments = [p.strip() for p in parts if p.strip()]
    else:
        if "\n\n" in txt:
            comments = [p.strip() for p in txt.split("\n\n") if p.strip()]
        else:
            comments = [l.strip() for l in txt.splitlines() if l.strip()]
    cleaned = []
    for c in comments:
        c = re.sub(r'^\s*[\-\•\*\d\)\.]+\s*', '', c).strip()
        if c:
            cleaned.append(c)
        if len(cleaned) >= expected:
            break
    return cleaned

def generate_comments(post_text: str, tone: str, length: str, num_comments: int, model: str) -> List[str]:
    prompt = build_prompt(post_text, tone, length, num_comments)
    raw = call_openrouter(prompt, model=model, max_tokens=450)
    return split_comments(raw, expected=num_comments)

# ---------------------------
# Streamlit UI
# ---------------------------
st.set_page_config(page_title="LinkedIn Comment Generator", layout="wide")
st.markdown("<h1 style='text-align:center;color:#1a73e8;'>💬 LinkedIn Comment Generator</h1>", unsafe_allow_html=True)

# ---------------------------
# Paste & Generate Button
# ---------------------------
if st.button("📋 Paste & Generate"):
    try:
        st.session_state["post_text"] = pyperclip.paste()
        post_text = st.session_state["post_text"]
        st.session_state["generate_now"] = True
    except Exception as e:
        st.error(f"Clipboard read failed: {e}")

post_text = st.session_state.get("post_text", "")

# ---------------------------
# Options (horizontal radio tiles)
# ---------------------------
col1, col2, col3, col4 = st.columns([1,1,1,2])
with col1:
    tone = st.radio("Tone", TONES, index=0, horizontal=True)
with col2:
    length = st.radio("Length", LENGTHS, index=1, horizontal=True)
with col3:
    num_comments = int(st.radio("Comments", [str(c) for c in COMMENT_COUNTS], index=0, horizontal=True))
with col4:
    model_choice = st.radio("Model", AVAILABLE_MODELS, index=0, horizontal=True)

# ---------------------------
# Generate comments if Paste & Generate clicked
# ---------------------------
if st.session_state.get("generate_now", False):
    if not post_text.strip():
        st.warning("No LinkedIn post found in clipboard.")
    else:
        with st.spinner("Generating comments…"):
            try:
                comments = generate_comments(post_text, tone, length, num_comments, model_choice)
                st.session_state["comments"] = comments
            except Exception as e:
                st.error(f"Error: {e}")
    st.session_state["generate_now"] = False

# ---------------------------
# Display comments with working copy buttons using HTML + JS
# ---------------------------
comments = st.session_state.get("comments", [])
for i, c in enumerate(comments, 1):
    safe_comment = c.replace("`", "\\`").replace("\n"," ")
    html(f"""
    <div style="background-color:#f0f4ff;padding:10px;margin-bottom:8px;border-radius:8px;border-left:5px solid #1a73e8; display:flex; justify-content: space-between; align-items: center;">
        <span>{safe_comment}</span>
        <button onclick="navigator.clipboard.writeText(`{safe_comment}`)" style="padding:4px 8px; cursor:pointer;">📋 Copy</button>
    </div>
    """, height=50)

st.caption("Built with Streamlit + OpenRouter. Paste & Generate reads clipboard. Click the copy icon to copy comments without page refresh.")
