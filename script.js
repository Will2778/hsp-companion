const state = {
  scene: "morning",
  playing: false,
  responding: false,
};

const storyInput = document.querySelector("#storyInput");
const conversationStack = document.querySelector("#conversationStack");
const initialInputPanel = document.querySelector("#initialInputPanel");
const historyList = document.querySelector("#historyList");
const breathText = document.querySelector("#breathText");
const soundToggle = document.querySelector("#soundToggle");
const soundTitle = document.querySelector("#soundTitle");
const soundHint = document.querySelector("#soundHint");
const volumeInput = document.querySelector("#volumeInput");
const generateButton = document.querySelector("#generateButton");

const crisisWords = ["自杀", "不想活", "活不下去", "结束生命", "伤害自己", "想死", "撑不住了"];

const sceneConfig = {
  morning: {
    title: "晨光钢琴", hint: "很轻的环境音和几颗钢琴音，适合白天缓一缓。",
    base: [196, 261.63], notes: [329.63, 392, 440, 392, 293.66], filter: 850,
  },
  rain: {
    title: "雨窗低语", hint: "柔和雨声感，适合把外界声音挡远一点。",
    base: [174.61, 220], notes: [293.66, 349.23, 392, 329.63], filter: 1200,
  },
  night: {
    title: "夜风慢拍", hint: "低一点、慢一点，适合睡前停止反刍。",
    base: [146.83, 196], notes: [246.94, 293.66, 329.63, 293.66], filter: 620,
  },
};

// ═══ 打字机引擎 ═══

let typewriterTimer = null;

// 停止当前正在进行的打字机
function stopTypewriter() {
  if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
}

// 在给定的容器中逐块揭示回应。container 是 response-stream 元素的引用。
function revealBlocks(blocks, container, onComplete) {
  let blockIndex = 0;
  container.innerHTML = "";

  function showNextBlock() {
    if (blockIndex >= blocks.length) {
      state.responding = false;
      if (onComplete) onComplete();
      return;
    }

    const blockHTML = blocks[blockIndex];
    const blockEl = document.createElement("div");
    blockEl.className = blockIndex === 0 ? "response-block response-block--first" : "response-block";
    blockEl.style.opacity = "0";
    blockEl.style.transform = "translateY(6px)";
    blockEl.innerHTML = blockHTML;
    container.appendChild(blockEl);

    requestAnimationFrame(() => {
      blockEl.style.transition = "opacity 0.8s ease, transform 0.8s ease";
      blockEl.style.opacity = "1";
      blockEl.style.transform = "translateY(0)";
    });

    revealBlockContent(blockEl, () => {
      blockIndex++;
      const blockPause = blockIndex === blocks.length
        ? 0
        : (blockIndex === blocks.length - 1 ? 2200 : 1800);
      typewriterTimer = setTimeout(showNextBlock, blockPause);
    });
  }

  showNextBlock();
}

// 逐句揭示一个块内的文本。直接操作文本节点，保留 HTML 标签结构。
function revealBlockContent(blockEl, onDone) {
  // 收集块内所有文本节点
  const textNodes = [];
  collectTextNodes(blockEl, textNodes);

  if (textNodes.length === 0) {
    if (onDone) onDone();
    return;
  }

  // 把每个文本节点的文字拆成句子序列
  const allSentences = [];
  textNodes.forEach(({ node, text }) => {
    const sentences = splitSentences(text);
    sentences.forEach(s => {
      allSentences.push({ node, text: s });
    });
  });

  // 先清空所有文本节点
  textNodes.forEach(({ node }) => { node.textContent = ""; });

  let sentenceIndex = 0;
  let currentChars = 0;

  function revealNextChar() {
    if (sentenceIndex >= allSentences.length) {
      if (onDone) onDone();
      return;
    }

    const { node, text } = allSentences[sentenceIndex];

    if (currentChars < text.length) {
      currentChars++;
      node.textContent = text.slice(0, currentChars);

      const char = text[currentChars - 1];
      let delay;
      if (char === "。" || char === "！" || char === "？") {
        delay = 120 + Math.random() * 60;
      } else if (char === "，" || char === "；") {
        delay = 80 + Math.random() * 40;
      } else if (char === "…") {
        delay = 150 + Math.random() * 100;
      } else {
        delay = 25 + Math.random() * 25;
      }

      typewriterTimer = setTimeout(revealNextChar, delay);
    } else {
      currentChars = 0;
      sentenceIndex++;
      const betweenPause = 200 + Math.random() * 300;
      typewriterTimer = setTimeout(revealNextChar, betweenPause);
    }
  }

  revealNextChar();
}

// 收集块内所有文本节点（保留 HTML 标签结构）
function collectTextNodes(element, result) {
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (text.trim().length > 0) {
        result.push({ node, text });
      }
      return;
    }
    if (node.nodeType !== 1) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  };
  walk(element);
}

// 把一段文本按句子分割
function splitSentences(text) {
  const sentences = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    if (text[i] === "。" || text[i] === "！" || text[i] === "？" || text[i] === "；") {
      sentences.push(current);
      current = "";
    }
  }
  if (current.trim().length > 0) {
    sentences.push(current);
  }
  return sentences;
}

// ═══ 对话流 ═══

// 创建一个 send-message 卡片显示用户刚写的文字
function createSentCard(text) {
  const card = document.createElement("div");
  card.className = "sent-message";
  card.innerHTML = `<p>${escapeHtml(text)}</p>`;
  return card;
}

// 创建一个 response-stream 卡片，打字机会往里写
function createResponseStream() {
  const card = document.createElement("div");
  card.className = "response-stream";
  card.innerHTML = `
    <div class="listening-indicator">
      <span class="listening-dot"></span>
      <span class="listening-dot"></span>
      <span class="listening-dot"></span>
    </div>
    <p class="listening-text">正在听……</p>
  `;
  return card;
}

// 创建一个继续输入框
function createContinueInput() {
  const wrapper = document.createElement("div");
  wrapper.className = "continue-input";
  wrapper.style.animationDelay = "0.6s";
  wrapper.innerHTML = `
    <textarea rows="1" placeholder="还想说什么……"></textarea>
    <div class="continue-actions">
      <button class="primary-action" data-action="continue">继续</button>
    </div>
  `;

  const textarea = wrapper.querySelector("textarea");
  const continueBtn = wrapper.querySelector('[data-action="continue"]');

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  });

  continueBtn.addEventListener("click", () => {
    const txt = textarea.value.trim();
    if (!txt || state.responding) return;
    submitMessage(txt, wrapper);
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const txt = textarea.value.trim();
      if (!txt || state.responding) return;
      submitMessage(txt, wrapper);
    }
  });

  return wrapper;
}

let initialControlsHidden = false;

// 提交消息的核心逻辑
function submitMessage(text, sourceWrapper) {
  if (state.responding) return;
  stopTypewriter();

  // 首次提交：隐藏初始的输入面板
  if (!initialControlsHidden) {
    initialInputPanel.classList.add("initial-hidden");
    generateButton.classList.add("initial-hidden");
    initialControlsHidden = true;
  }

  // 替换来源卡片：输入区 → sent 卡片
  const sentCard = createSentCard(text);
  sourceWrapper.replaceWith(sentCard);

  // 在 sent 卡片后面插入 response-stream
  const responseStream = createResponseStream();
  sentCard.after(responseStream);

  responseStream.scrollIntoView({ behavior: "smooth", block: "center" });

  state.responding = true;

  if (hasCrisisSignal(text)) {
    typewriterTimer = setTimeout(() => {
      revealBlocks(
        [
          `<h3>现在先把安全放到第一位</h3><p>你写的内容里有很强的危险信号。请不要一个人扛着，立刻联系身边可信的人、当地紧急服务或专业心理危机支持。</p>`,
          `<h3>可以直接发出的短信</h3><p>我现在很难受，可能不太安全。你能马上联系我，或者来陪我一会儿吗？我不想一个人扛着。</p>`,
          `<h3>先保证你不是一个人</h3><p>你不是负担。你只是需要一只手。让别人握住它。</p>`,
        ],
        responseStream,
        () => appendContinue(responseStream)
      );
    }, 2500);
    if (text) saveHistory(text, "危机求助");
    return;
  }

  const details = parseInput(text);
  if (!details) {
    typewriterTimer = setTimeout(() => {
      revealBlocks(
        [`<p>有时候不确定说什么也很正常。不需要完整的句子，只要感觉到自己在试着照顾自己，这本身就已经是一步了。</p>`],
        responseStream,
        () => appendContinue(responseStream)
      );
    }, 2000);
    return;
  }

  const blocks = buildPersonalizedResponse(details);

  typewriterTimer = setTimeout(() => {
    revealBlocks(blocks, responseStream, () => appendContinue(responseStream));
  }, 2500);

  if (text) saveHistory(text, details.mood);
}

// 回应打完后，在下方插入继续输入框
function appendContinue(responseStream) {
  const continueInput = createContinueInput();
  responseStream.after(continueInput);
  continueInput.querySelector("textarea").focus();
}

// ═══ 按钮状态 ═══

function updateButtonState() {
  // generateButton 在第一次提交后就被隐藏了，这里只需处理初始按钮
  if (!initialControlsHidden && generateButton) {
    if (state.responding) {
      generateButton.textContent = "正在听……";
      generateButton.disabled = true;
      generateButton.style.opacity = "0.7";
    } else {
      generateButton.textContent = "帮我把它放轻一点";
      generateButton.disabled = false;
      generateButton.style.opacity = "1";
    }
  }
}

// ═══ 回应引擎 ═══

function parseInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 自动推断情绪类型
  let mood = "反复想";
  if (/睡|夜|失眠|凌晨|躺下/.test(trimmed)) mood = "睡前焦虑";
  else if (/心跳|呼吸|胸[口闷]|肩膀|头[疼痛晕]|肚子|胃|手[抖颤]|发[抖冷]|紧绷|喘不过气|睡不[着好]/.test(trimmed)) mood = "身体紧绷";
  else if (/同事|朋友|家人|伴侣|对象|妈妈|爸爸|老师|同学|客户|闺蜜|兄弟|领导|老板/.test(trimmed) && /消息|回复|微信|冷淡|不理|态度|关系|吵架|冷战/.test(trimmed)) mood = "人际压力";
  else if (/错|失败|否定|批评|丢脸|没用|不够好|太差|太弱|太笨/.test(trimmed)) mood = "被否定";

  // 自动推断紧张程度
  let level = 5;
  const intensityCount = (trimmed.match(/(?:一直|不停|永远|总是|越来越|反复|根本|实在|真的|太|最|完全|彻底)/g) || []).length;
  const crisisCount = (trimmed.match(/(?:撑不住|受不了|崩溃|绝望|完了|怎么办|谁来帮|救我|扛不住|顶不住)/g) || []).length;
  const bodyCount = (trimmed.match(/(?:心跳|呼吸|胸口|胸闷|肩膀|头疼|头晕|肚子|胃|手抖|手颤|发抖|发冷|紧绷|喘不过气|睡不着)/g) || []).length;
  level = Math.min(10, 4 + intensityCount + crisisCount * 2 + bodyCount);

  // 自动选择语气
  let tone = "soft";
  if (/为什么|到底|到底是不是|是不是我的错|怎么办|是不是我不|我到底/.test(trimmed)) tone = "clear";
  if (/我就说|我说真的|烦|讨厌|气死|委屈|憋屈|聊一聊|和我说|跟我说|有没有人/.test(trimmed)) tone = "friend";

  return {
    raw: trimmed,
    mood: mood,
    level: level,
    tone: tone,
    people: (trimmed.match(/(?:领导|老板|同事|朋友|家人|伴侣|对象|妈妈|爸爸|老师|同学|客户|闺蜜|兄弟)/g) || []),
    timeClues: (trimmed.match(/(?:今天|昨天|刚才|刚刚|早上|晚上|下午|开会|面试|考试|上班|下班|睡前|躺下)/g) || []),
    bodyFeelings: (trimmed.match(/(?:心跳|呼吸|胸[口闷]|肩膀|头[疼痛晕]|肚子|胃|手[抖颤]|发[抖冷]|紧绷|喘不过气|睡不[着好])/g) || []),
    selfCriticism: (trimmed.match(/(?:我不够[好行强棒]|我是不是[很太]|又[犯错搞砸]|永远[都不行]|怎么[这那]么|是不是我[的错问题]|都怪[我自]|对不起|我太[差弱傻蠢笨]|别人都|我做不到)/g) || []),
    intensityWords: (trimmed.match(/(?:一直|不停|永远|总是|越来越|反复|根本|实在|真的|太|最|完全|彻底)/g) || []),
    sceneWords: (trimmed.match(/(?:消息|回复|微信|朋友圈|群[聊组]|电话|邮件|报告|方案|代码|数据|成绩|绩效|评分|评价|打分)/g) || []),
    hasStory: trimmed.length > 20 && /[，。；！？、]/.test(trimmed),
    isBrief: trimmed.length < 10,
  };
}

function buildPersonalizedResponse(details) {
  const blocks = [];
  const highStress = details.level >= 7;
  const crisisLevel = details.level >= 9;

  blocks.push(pickComfortOpening(details, details.tone, details.mood, highStress));

  if (details.hasStory && !crisisLevel) {
    const reflection = buildReflection(details, details.mood);
    if (reflection) blocks.push(reflection);
  }

  blocks.push(buildAction(details, details.tone, details.level));
  blocks.push(pickClosing(details, details.tone, details.mood));

  return blocks;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickComfortOpening(d, tone, mood, highStress) {
  if (d.hasStory) {
    const timeRef = d.timeClues.length ? d.timeClues[0] : "刚才";
    const personRef = d.people.length ? d.people[0] : "";
    const sceneRef = d.sceneWords.length ? d.sceneWords[0] : (personRef ? personRef + "说的事" : "这件事");

    const comfortPool = [
      `<h3>先接住你</h3><p>你说的${timeRef}关于"<em>${escapeHtml(d.raw.slice(0, 40))}${d.raw.length>40?'…':''}</em>"——这件事让你难受，不是你太敏感。是这件事真的碰到了你在意的地方。</p><p>${highStress ? '先不做任何判断。现在只需要让身体知道：此刻是安全的。' : '先允许自己有这个情绪，不用急着赶走它。'}</p>`,

      `<h3>先不急着分析</h3><p>${timeRef}的${sceneRef}，你到现在还在想。这种反复咀嚼不是因为你"想太多"，而是因为你比别人更在意细节、更怕伤害关系、更想把事情做好。这些品质本身没有错。</p><p>${pick(['先蹲下来。不急着站起来。','允许自己先在难受里待一会儿。','你不需要立刻变好。'])}</p>`,

      `<h3>听到了</h3><p>${timeRef}发生的事情，现在还在你脑子里转。${d.intensityWords.length ? '你说"'+d.intensityWords[0]+'"——这种感觉很累，我知道。' : '这种感觉很重，我知道。'}</p><p>${pick(['不是你的问题。你只是比别人多感受了一层。','高敏感的人会更快捕捉到别人的语气和表情，所以事后反复想并不奇怪。','允许自己暂时不处理这件事。它的重量可以先放在这里，你不需要一直扛着。'])}</p>`,
    ];

    return pick(comfortPool);
  }

  if (d.isBrief) {
    return `<h3>没关系</h3><p>有时候说不清楚才是最真实的状态。不是每次难受都需要一个完整的句子才能被看见。</p><p>${pick(['你可以就这样待一会儿。','不需要解释。','我在这里。'])}</p>`;
  }

  return `<h3>先接住你</h3><p>你现在需要的是被接住，不是被分析。${highStress ? '先让呼吸变慢，让肩膀离开耳朵。' : '先不用急着弄清楚原因。'}</p><p>${pick(['难受的时候，不用一个人撑着。','你的感觉是真实的，不需要被证明。','先把"我应该没事"放一边。你现在感觉不好，这件事本身就足够被认真对待。'])}</p>`;
}

function buildReflection(d, mood) {
  const selfCrit = d.selfCriticism.length ? d.selfCriticism[0] : "";
  const bodySig = d.bodyFeelings.length ? d.bodyFeelings[0] : "";
  const reflections = [];

  if (selfCrit) {
    reflections.push(
      `<h3>你注意到了自己说"${selfCrit}"</h3><p>这句话可能不是你自己的声音。它更像是一个内化了太久的评判者，一有机会就跳出来。</p><p>${pick(['试着把这句话的主语换成关心你的人，比如"XX觉得我不够好"。听起来就不一样了，对吗？','当你脑子里出现这句话的时候，可以问自己：这是我自己的判断，还是我害怕别人会这么想？','先不反驳它，只是看见它。它不是事实，它只是一个念头。'])}</p>`
    );
  }

  if (bodySig) {
    reflections.push(
      `<h3>你的身体在说话</h3><p>"${bodySig}"——身体比大脑更早知道你在紧张。这不是你的敌人，是你的警报系统太尽责了。</p><p>${pick(['把手放在那里，什么都不做，只是让温度传过去。','你的身体不是在背叛你，它是在保护你。只是音量开太大了。','先不对抗它。感觉它，然后让它知道你注意到了。'])}</p>`
    );
  }

  if (reflections.length === 0) {
    reflections.push(
      `<h3>拆开来看</h3><p>你现在感受到的，可能不止是${d.timeClues.length?d.timeClues[0]:'刚才'}这一件事。它可能勾住了之前没完全消化的东西。</p><p>${pick(['不需要一次全部理清。只是知道它们混在一起了，就已经是很大的一步。','一件事叠着另一件事的时候，会觉得特别重。不是因为你不坚强，是它们真的太多了。'])}</p>`
    );
  }

  return pick(reflections);
}

function buildAction(d, tone, level) {
  const needGrounding = level >= 8;
  const hasPeople = d.people.length > 0;
  const hasBody = d.bodyFeelings.length > 0;
  const hasSelfCrit = d.selfCriticism.length > 0;

  if (needGrounding) {
    return `<h3>现在做一件很小的事</h3><p>先不用想任何事。找到一个你能看到的物体，说出它的名字、颜色、质感。然后是第二个。然后是第三个。</p><p>等你感觉自己还在这个房间里，再决定要不要继续想。${pick(['先回到身体里。别的事可以等。','让世界先安静 30 秒。不是逃避，是给自己缓冲。'])}</p>`;
  }

  const actions = [];

  if (hasBody) {
    const part = d.bodyFeelings[0];
    actions.push(
      `<h3>对你的身体做一件事</h3><p>你说的"${part}"——现在把手放在那个部位上面，或者附近。不用按摩，不用放松，只是让手心温度传过去。</p><p>${pick(['10 秒就够了。','这不是在解决问题，是在给你的身体一点信号：我知道你在紧张。','边放边呼一口气，让肩胛骨往下沉一厘米就好。'])}</p>`
    );
  }

  if (hasSelfCrit) {
    const criticism = d.selfCriticism[0];
    actions.push(
      `<h3>把这个声音写下来</h3><p>拿出手机备忘录，把"${criticism}"这句话打出来。然后在下面写一句：<strong>这是焦虑说的话，不等于实际情况。</strong></p><p>${pick(['写完就不用再跟它辩论了。先放一边。','然后关掉备忘录，去做一件不需要动脑的事。','你不需要反驳它，也不需要相信它。只是把它从脑子里挪到屏幕上。'])}</p>`
    );
  }

  if (hasPeople) {
    const person = d.people[0];
    actions.push(
      `<h3>关于${person}</h3><p>${pick([
        '你不需要在今天之内弄懂对方在想什么。不知道也没关系。',
        '对方的反应可能和你的表现无关。人的沟通有很多层，你只听到了其中一层。',
        '一个人的一句话、一次反应，不够定义你整个人。你现在只是被刺痛了，不是被判定了。',
      ])}</p><p>${pick(['先给自己 24 小时，之后再说。','今晚的目标不是想通，是让自己先睡一觉。'])}</p>`
    );
  }

  if (actions.length === 0) {
    actions.push(
      `<h3>一件很小的事</h3><p>${pick([
        '离开屏幕，去喝一杯水。慢慢喝。感觉水从喉咙流下去。然后回来。',
        '站起来，走到窗户旁边，看远处的任何东西 30 秒。不需要想什么。',
        '找一个你喜欢的触感：毛衣的袖子、杯子的温度、枕头的一角。摸 10 秒钟。',
        '如果你愿意，可以给自己发一条语音微信，就当在跟朋友说话。说完不用发出去。',
      ])}</p>`
    );
  }

  return pick(actions);
}

function pickClosing(d, tone, mood) {
  const closings = {
    soft: [
      "你可以敏感，也可以慢慢恢复。此刻不需要立刻变得完美。",
      "不是所有的低落都需要被解决。有些时候，只是需要被陪着。",
      "高敏感不是弱点。你比别人更早感受到风，也更容易被风刮到——这只是一件事的两面。",
      "你的感受不需要被证明是合理的。它在这里，就已经足够被认真对待。",
      "先不用忙着变好。先在这里待一会儿。",
    ],
    clear: [
      "先处理事实，再处理想象。两者都值得被看见，但不用混在一起。",
      "焦虑的声音很大，但不等于它的内容是对的。把它当成一个过度尽责的警报，而不是事实播报。",
      "你今天不需要得出任何结论。可以先放下，明天再捡起来看。",
    ],
    friend: [
      "你不是麻烦，也不是想太多。你只是需要一个更轻的落点。",
      "说真的，你已经很努力了。休息一下不是放弃，是在给自己续杯。",
      "要是我在你旁边，我会先陪你坐一会儿，不急着分析，也不逼你马上开心。",
    ],
  };

  const pool = closings[tone] || closings.soft;
  return `<h3>留给自己的话</h3><p class="comfort-line">${pick(pool)}</p>`;
}

function hasCrisisSignal(text) {
  return crisisWords.some((word) => text.includes(word));
}

// ═══ 辅助 ═══

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

function saveHistory(text, mood) {
  const records = JSON.parse(localStorage.getItem("hsp-records") || "[]");
  records.unshift({
    text,
    mood: mood || "反复想",
    time: new Date().toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
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

// ═══ 音频 ═══

let audio = null;
let noteTimer = null;
let breathTimer = null;
let breathIndex = 0;
const breathSteps = ["慢慢吸气", "停一下", "慢慢呼气", "让肩膀落下来"];

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
  if (noteTimer) { window.clearInterval(noteTimer); noteTimer = null; }
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

// ═══ 事件绑定 ═══

document.querySelectorAll(".scene-chip").forEach((button) => {
  button.addEventListener("click", () => updateScene(button.dataset.scene));
});

volumeInput.addEventListener("input", () => {
  if (audio) audio.master.gain.value = Number(volumeInput.value) / 100 * 0.55;
});

soundToggle.addEventListener("click", () => {
  if (state.playing) stopAudio();
  else startAudio();
});

generateButton.addEventListener("click", () => {
  const text = storyInput.value.trim();
  if (!text || state.responding) return;
  submitMessage(text, initialInputPanel);
});

// 回车也能提交
storyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const text = storyInput.value.trim();
    if (!text || state.responding) return;
    submitMessage(text, initialInputPanel);
  }
});

document.querySelector("#clearButton").addEventListener("click", () => {
  stopTypewriter();
  state.responding = false;

  if (initialControlsHidden) {
    initialInputPanel.classList.remove("initial-hidden");
    generateButton.classList.remove("initial-hidden");
    initialControlsHidden = false;
  }

  const dynamicCards = conversationStack.querySelectorAll(".sent-message, .response-stream, .continue-input");
  dynamicCards.forEach(el => el.remove());

  storyInput.value = "";
  storyInput.focus();
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
