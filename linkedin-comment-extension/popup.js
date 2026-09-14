async function getOpenRouterApiKey() {
  const stored = await chrome.storage.local.get("openrouterApiKey");
  if (stored.openrouterApiKey) {
    return stored.openrouterApiKey;
  }

  const apiKey = window.prompt("Enter your OpenRouter API key:");
  if (!apiKey || !apiKey.trim()) {
    throw new Error("An OpenRouter API key is required.");
  }

  await chrome.storage.local.set({ openrouterApiKey: apiKey.trim() });
  return apiKey.trim();
}

document.getElementById("generateBtn").addEventListener("click", async () => {
  const postText = document.getElementById("postText").value.trim();
  const tone = document.getElementById("tone").value;
  const length = document.getElementById("length").value;
  const numComments = document.getElementById("numComments").value;
  const model = document.getElementById("model").value;

  if (!postText) {
    alert("Please paste a LinkedIn post first.");
    return;
  }

  const prompt = `
You are an assistant that writes natural LinkedIn comments.

Requirements:
- Produce exactly ${numComments} unique comments.
- Tone: ${tone}.
- Length: ${length}.
- Avoid sounding like AI.
- Output only the comments.

Post:
"""${postText}"""
  `;

  try {
    const apiKey = await getOpenRouterApiKey();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant that writes natural LinkedIn comments." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 400
      })
    });

    const data = await response.json();
    const output = data.choices[0].message.content;

    // Try to split comments into separate parts
    let comments = output.split(/\n\d+[\).\-\s]/).filter(c => c.trim() !== "");
    if (comments.length < numComments) {
      comments = output.split(/\n\n+/).filter(c => c.trim() !== "");
    }

    // Show each comment with a copy button
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<b>Generated Comments:</b><br><br>";

    comments.forEach((comment, index) => {
      const commentDiv = document.createElement("div");
      commentDiv.className = "comment-block";

      const text = document.createElement("p");
      text.innerText = comment.trim();

      const copyBtn = document.createElement("button");
      copyBtn.innerText = "📋 Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(comment.trim());
        copyBtn.innerText = "✅ Copied!";
        setTimeout(() => copyBtn.innerText = "📋 Copy", 1500);
      });

      commentDiv.appendChild(text);
      commentDiv.appendChild(copyBtn);
      resultsDiv.appendChild(commentDiv);
    });
  } catch (err) {
    document.getElementById("results").innerText = "Error: " + err.message;
  }
});
