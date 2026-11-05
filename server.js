// Простой сервер без зависимостей (нужен Node.js 18+)
// Версия с БЕСПЛАТНЫМ ИИ: Groq
const http = require("http");
const fs = require("fs");

// Читаем ключ из файла .env (строка: GROQ_API_KEY=ваш_ключ)
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.error("Нет ключа! Создайте файл .env со строкой GROQ_API_KEY=ваш_ключ");
  process.exit(1);
}

const MODEL = "openai/gpt-oss-120b"; // бесплатная модель на Groq

const SYSTEM = `Ты весёлый судья игры "What Beats Rock" (что побеждает камень).
Тебе дают текущее слово и ответ игрока. Реши, побеждает ли ответ игрока текущее слово.
Будь логичным, но не занудой: креативные и шуточные ответы допустимы, если в них есть смысл.
Верни ТОЛЬКО JSON без пояснений и без markdown:
{"beats": true или false, "emoji": "ОДИН стандартный эмодзи, подходящий к слову игрока", "comment": "1-2 коротких предложения на русском с юмором"}
Если ответ НЕ побеждает - в comment смешно объясни, почему он не подходит.
Если побеждает - коротко и с юмором похвали или прокомментируй.`;

async function judge(current, guess) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Текущее слово: ${current}\nОтвет игрока: ${guess}` },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_completion_tokens: 1000,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Ошибка API");
  const text = data.choices[0].message.content;
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

http
  .createServer(async (req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync("index.html"));
    }
    if (req.method === "POST" && req.url === "/api/judge") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { current, guess } = JSON.parse(body);
        const result = await judge(String(current).slice(0, 60), String(guess).slice(0, 60));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    res.writeHead(404).end();
  })
  .listen(3000, () => console.log("Игра запущена: http://localhost:3000"));
