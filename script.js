const state = {
  mood: "被否定",
  tone: "soft",
  scene: "morning",
  playing: false,
};

const storyInput = document.querySelector("#storyInput");
const resultPanel = document.querySelector("#resultPanel");
const levelInput = document.querySelector("#levelInput");
const levelText = document.querySelector("#levelText");
const historyList = document.querySelector("#historyList");
const breathText = document.querySelector("#breathText");
const soundToggle = document.querySelector("#soundToggle");
const soundTitle = document.querySelector("#soundTitle");
const soundHint = document.querySelector("#soundHint");
const volumeInput = document.querySelector("#volumeInput");

const crisisWords = ["自杀", "不想活", "活不下去", "结束生命", "伤害自己", "想死", "撑不住了"];

const moodPlaceholders = {
  被否定: "比如：今天开会被否定了，我一直在想是不是我不够好。",
  反复想: "比如：一句话我想了一晚上，脑子停不下来。",
  人际压力: "比如：朋友回复很冷淡，我开始担心是不是自己做错了。",
  睡前焦虑: "比如：一躺下就开始想今天哪里没做好，越想越清醒。",
  身体紧绷: "比如：我心跳很快，肩膀很紧，好像随时会出事。",
};

const toneText = {
  soft: {
    comfort: "你会这么难受，不是因为你太脆弱，而是这件事碰到了你很在意的地方。先不用急着证明自己没事，身体和心都可以慢一点。",
    reframe: "现在脑子里最响的声音，可能是“是不是我不好”。但这只是焦虑给出的解释，不等于事实本身。",
    action: "把手放在胸口或腹部，慢慢呼气 6 秒。然后只写一句客观事实，不写评价。",
    line: "我可以敏感，也可以慢慢恢复。此刻我不需要立刻变得完美。",
  },
  clear: {
    comfort: "你的反应可以被理解。高敏感的人会更快捕捉语气、表情和细节，所以事后反复回想并不奇怪。",
    reframe: "先分开三件事：实际发生了什么，你推测了什么，你害怕它说明什么。焦虑常常把这三件事揉在一起。",
    action: "列出 2 个证据支持你的担心，再列出 2 个证据说明事情可能没那么糟。",
    line: "我先处理事实，再处理想象。两者都值得被看见，但不用混在一起。",
  },
  friend: {
    comfort: "先别骂自己。要是我在你旁边，我会先陪你坐一会儿，不急着分析，也不逼你马上开心。",
    reframe: "一个人的一句话、一次反应，不够定义你整个人。你现在只是被刺痛了，不是被判定了。",
    action: "先喝点水，离开屏幕 3 分钟。回来之后给这件事起个名字，比如“我被否定后的脑内循环”。",
    line: "你不是麻烦，也不是想太多。你只是需要一个更轻的落点。",
  },
};

const themeAdvice = {
  自我否定: "这类痛感常常不是来自“事件本身”，而是来自它像是在证明“我不够好”。我们先不要让一个片段替你下结论。",
  关系压力: "关系里的不确定会让高敏感的人不断扫描细节。可以先允许自己不知道答案，不急着补全对方的想法。",
  睡前反刍: "睡前大脑会把未完成的事拿出来反复播放。今晚的目标不是想通，而是把它暂时放到明天。",
  身体警报: "身体像警报器一样响起来时，先不用跟它争辩。让呼吸变长、让肩膀变低，就是在告诉身体：我正在回到安全。",
  反复想: "反复想并不说明你矫情，它更像是大脑想保护你、却把音量开太大。现在可以先把音量调小一点。",
};

const sceneConfig = {
  morning: {
    title: "晨光钢琴",
    hint: "很轻的环境音和几颗钢琴音，适合白天缓一缓。",
    base: [196, 261.63],
    notes: [329.63, 392, 440, 392, 293.66],
    filter: 850,
  },
  rain: {
    title: "雨窗低语",
    hint: "柔和雨声感，适合把外界声音挡远一点。",
    base: [174.61, 220],
    notes: [293.66, 349.23, 392, 329.63],
    filter: 1200,
  },
  night: {
    title: "夜风慢拍",
    hint: "低一点、慢一点，适合睡前停止反刍。",
    base: [146.83, 196],
    notes: [246.94, 293.66, 329.63, 293.66],
    filter: 620,
  },
};

let audio = null;
let noteTimer = null;
let breathTimer = null;
let breathIndex = 0;
const breathSteps = ["慢慢吸气", "停一下", "慢慢呼气", "让肩膀落下来"];

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function detectTheme(text) {
  if (/睡|夜|失眠|凌晨|躺下/.test(text) || state.mood === "睡前焦虑") return "睡前反刍";
  if (/同事|朋友|家人|伴侣|领导|关系|消息|回复|冷淡/.test(text) || state.mood === "人际压力") return "关系压力";
  if (/错|失败|否定|批评|丢脸|没用|不够好/.test(text) || state.mood === "被否定") return "自我否定";
  if (/心跳|呼吸|胸|发抖|身体|肩膀|紧绷/.test(text) || state.mood === "身体紧绷") return "身体警报";
  return "反复想";
}

function hasCrisisSignal(text) {
  return crisisWords.some((word) => text.includes(word));
}

function buildResponse(text) {
  const trimmed = text.trim();
  const theme = detectTheme(trimmed);
  const tone = toneText[state.tone];
  const level = Number(levelInput.value);
  const needGrounding = level >= 8;
  const safeText = escapeHtml(trimmed || "我现在有点难受，但还说不清楚原因。");

  if (hasCrisisSignal(trimmed)) {
    return `
      <div class="response-block alert">
        <h3>现在先把安全放到第一位</h3>
        <p>你写的内容里有很强的危险信号。请不要一个人扛着，立刻联系身边可信的人、当地紧急服务或专业心理危机支持。如果身边有可能伤害自己的物品，先把它们移远，去到有人在的地方。</p>
      </div>
      <div class="response-block">
        <h3>可以直接发出的短信</h3>
        <p>我现在很难受，可能不太安全。你能马上联系我，或者来陪我一会儿吗？我不想一个人扛着。</p>
      </div>
    `;
  }

  return `
    <div class="response-block">
      <h3>先接住你</h3>
      <p>${tone.comfort}</p>
    </div>
    <div class="response-block">
      <h3>这更像是：${theme}</h3>
      <p>${themeAdvice[theme]}</p>
    </div>
    <div class="response-block">
      <h3>把它拆小一点</h3>
      <ul>
        <li>事实：${safeText}</li>
        <li>想法：我可能正在把一个片段扩展成“我整个人都不好”。</li>
        <li>另一种可能：对方的表达、状态、处境，也可能影响了这次互动。</li>
      </ul>
    </div>
    <div class="response-block">
      <h3>现在做一件很小的事</h3>
      <p>${needGrounding ? "先看见周围 5 个物体，摸到 4 个触感，听见 3 个声音。等身体降下来，再决定要不要继续想。" : tone.action}</p>
    </div>
    <div class="response-block">
      <h3>留给自己的话</h3>
      <p class="comfort-line">${tone.line}</p>
    </div>
  `;
}

function saveHistory(text) {
  const records = JSON.parse(localStorage.getItem("hsp-records") || "[]");
  records.unshift({
    text,
    mood: state.mood,
    time: new Date().toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  localStorage.setItem("hsp-records", JSON.stringify(records.slice(0, 12)));
  renderHistory();
}

function renderHistory() {
  const records = JSON.parse(localStorage.getItem("hsp-records") || "[]");
  historyList.innerHTML = records.length
    ? records.map((record) => `
        <article class="history-item">
          <time>${record.time} · ${escapeHtml(record.mood)}</time>
          <p>${escapeHtml(record.text)}</p>
        </article>
      `).join("")
    : `<article class="history-item"><p>还没有记录。这里不是用来审判自己的，只是帮你看见：很多情绪都会过去。</p></article>`;
}

function createNoiseBuffer(ctx) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 2.7;
  }
  return buffer;
}

function playNote(freq) {
  if (!audio || !state.playing) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.085, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + 3);
}

function startAudio() {
  stopAudio();
  const config = sceneConfig[state.scene];
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = Number(volumeInput.value) / 100 * 0.55;
  master.connect(ctx.destination);

  const padGain = ctx.createGain();
  padGain.gain.value = 0.045;
  padGain.connect(master);
  const oscillators = config.base.map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(padGain);
    osc.start();
    return osc;
  });

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx);
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = config.filter;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = state.scene === "rain" ? 0.042 : 0.022;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();

  audio = { ctx, master, oscillators, noise };
  state.playing = true;
  soundToggle.classList.add("is-playing");
  soundToggle.setAttribute("aria-label", "暂停轻音乐");
  soundHint.textContent = "正在播放。声音故意做得很轻，像在房间另一侧。";

  let noteIndex = 0;
  playNote(config.notes[0]);
  noteTimer = window.setInterval(() => {
    noteIndex = (noteIndex + 1) % config.notes.length;
    playNote(config.notes[noteIndex]);
  }, state.scene === "night" ? 5200 : 4200);
}

function stopAudio() {
  if (noteTimer) {
    window.clearInterval(noteTimer);
    noteTimer = null;
  }
  if (audio) {
    audio.oscillators.forEach((osc) => osc.stop());
    audio.noise.stop();
    audio.ctx.close();
    audio = null;
  }
  state.playing = false;
  soundToggle.classList.remove("is-playing");
  soundToggle.setAttribute("aria-label", "播放轻音乐");
  soundHint.textContent = sceneConfig[state.scene].hint;
}

function updateScene(scene) {
  state.scene = scene;
  soundTitle.textContent = sceneConfig[scene].title;
  soundHint.textContent = sceneConfig[scene].hint;
  document.querySelectorAll(".scene-chip").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.scene === scene);
  });
  if (state.playing) startAudio();
}

function startBreathText() {
  breathTimer = window.setInterval(() => {
    breathIndex = (breathIndex + 1) % breathSteps.length;
    breathText.textContent = breathSteps[breathIndex];
  }, 2600);
}

document.querySelectorAll(".mood-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mood-chip").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    state.mood = button.dataset.mood;
    storyInput.placeholder = moodPlaceholders[state.mood];
  });
});

document.querySelectorAll(".tone").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tone").forEach((item) => {
      item.classList.remove("is-selected");
      item.setAttribute("aria-checked", "false");
    });
    button.classList.add("is-selected");
    button.setAttribute("aria-checked", "true");
    state.tone = button.dataset.tone;
  });
});

document.querySelectorAll(".scene-chip").forEach((button) => {
  button.addEventListener("click", () => updateScene(button.dataset.scene));
});

levelInput.addEventListener("input", () => {
  levelText.textContent = levelInput.value;
});

volumeInput.addEventListener("input", () => {
  if (audio) audio.master.gain.value = Number(volumeInput.value) / 100 * 0.55;
});

soundToggle.addEventListener("click", () => {
  if (state.playing) stopAudio();
  else startAudio();
});

document.querySelector("#generateButton").addEventListener("click", () => {
  const text = storyInput.value.trim();
  resultPanel.classList.remove("is-empty");
  resultPanel.innerHTML = buildResponse(text);
  if (text && !hasCrisisSignal(text)) saveHistory(text);
});

document.querySelector("#clearButton").addEventListener("click", () => {
  storyInput.value = "";
  resultPanel.classList.add("is-empty");
  resultPanel.innerHTML = `<p class="empty-text">如果写不出来，也可以只写一句：“我现在有点难受。”</p>`;
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`#${tab.dataset.view}`).classList.add("is-active");
    if (tab.dataset.view === "journalView") renderHistory();
  });
});

document.querySelector("#deleteHistoryButton").addEventListener("click", () => {
  localStorage.removeItem("hsp-records");
  renderHistory();
});

document.querySelector("#safeTemplateButton").addEventListener("click", () => {
  const message = document.querySelector("#safeMessage");
  message.select();
});

renderHistory();
startBreathText();
