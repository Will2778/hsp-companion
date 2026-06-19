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
    var fallbacks = shuffle([
      "<p>有时候不确定说什么也很正常。不需要完整的句子，只要感觉到自己在试着照顾自己，这本身就已经是一步了。</p>",
      "<p>如果写不出来，可以先不管。光是打开这个页面，就说明你在试着照顾自己。这一点本身就很好了。</p>",
      "<p>没关系。现在不需要说什么。你可以就这样待一会儿。</p>",
    ]);
    typewriterTimer = setTimeout(() => {
      revealBlocks([fallbacks[0]], responseStream, () => appendContinue(responseStream));
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

// ═══ 文本工具 ═══
function rnd(max) { return Math.floor(Math.random() * max); }
function pick(arr) { return arr[rnd(arr.length)]; }
function oneIn(n) { return rnd(n) === 0; }

// 打散数组顺序，避免相同的句子每次都按同样顺序出现
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = rnd(i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

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

// 构建回应。不再用固定 4 块模板——每次的段落数和结构都不同
function buildPersonalizedResponse(d) {
  var timeRef = d.timeClues.length ? d.timeClues[0] : "刚才";
  var personRef = d.people.length ? d.people[0] : "";
  var quote = d.raw.length > 40 ? escapeHtml(d.raw.slice(0, 40)) + "…" : escapeHtml(d.raw);
  var high = d.level >= 7;
  var sp = "<br><br>";

  // 根据内容类型选不同的回应"形状"
  if (d.isBrief && d.raw.length < 5) {
    return [buildBriefAck(d)];
  }

  if (high && d.bodyFeelings.length) {
    return buildBodyFirstResponse(d, timeRef, quote, sp);
  }

  if (d.hasStory && d.selfCriticism.length) {
    return oneIn(2) ? buildDeepUnpack(d, timeRef, quote, sp) : buildSoftDeflect(d, timeRef, quote, sp);
  }

  if (d.people.length && d.sceneWords.length) {
    return buildRelationshipResponse(d, timeRef, personRef, quote, sp);
  }

  // 默认：随机选一种形状
  var shapes = shuffle([
    function(){return buildShortWarm(d, timeRef, quote, sp)},
    function(){return buildTwoPart(d, timeRef, quote, sp)},
    function(){return buildQuestionEnd(d, timeRef, quote, sp)},
  ]);
  return shapes[0]();
}

// ═══ 回应形状 1: 写了很少（一个词/短句）═══
function buildBriefAck(d) {
  var pool = shuffle([
    "<p>嗯。有时候一个词就够了。不需要解释什么。</p>",
    "<p>我听到了。不用把它展开成更完整的句子。</p>",
    "<p>有时候" + escapeHtml(d.raw) + "就是全部了。不需要更多解释。</p>",
    "<p>说不清楚的时候，不勉强自己说清楚，也是一种照顾自己的方式。</p>",
    "<p>没关系。不完整的句子也可以被认真对待。</p>",
  ]);
  return pool[0];
}

// ═══ 回应形状 2: 身体紧绷优先 grounding ═══
function buildBodyFirstResponse(d, timeRef, quote, sp) {
  var part = d.bodyFeelings[0];
  var opens = shuffle([
    "<p>" + timeRef + "你说的" + quote + "——嗯，我注意到你还提到了" + part + "。</p>",
    "<p>你的身体已经在告诉你了。不是大脑在骗你，" + part + "是真实的感觉。</p>",
  ]);
  var mids = shuffle([
    "<p>现在把手放在" + part + "上面。不用按摩，什么都不用做。手心温度传过去就行。10 秒。然后呼一口气，让肩膀往下沉一点。</p>",
    "<p>身体的紧张不是敌人。它是一个在拼命保护你的警报器。只是音量开太大了。先不跟它辩论，只是让它知道——你注意到了。</p>",
    "<p>先不处理事情。先处理身体。你可以在椅子上坐得更重一点，让脚底板完全贴在地上。感觉一下重量往下走。</p>",
  ]);
  var closes = shuffle([
    "<p>等你身体降下来了，那些想法会变轻。不是消失了，是不再揪着你了。</p>",
    "<p>事情可以晚一点再想。身体说它需要被接住，那就先接住它。</p>",
    "",
  ]);
  return [opens[0] + sp + mids[0] + (closes[0] ? sp + closes[0] : "")];
}

// ═══ 回应形状 3: 深入拆解自我批判 ═══
function buildDeepUnpack(d, timeRef, quote, sp) {
  var criticism = d.selfCriticism[0];
  var opens = shuffle([
    "<p>" + quote + "——你说你" + criticism + "。这句话你在心里说了多久了？</p>",
    "<p>我注意到" + timeRef + "的事情里，你反复用了一个词：" + criticism + "。</p>",
  ]);
  var mids = shuffle([
    "<p>这句话可能不是你的声音。它像是一个住了很久的访客，一遇到事就自动跳出来替你说话。但它不是你。</p>" + sp + "<p>试着把主语换一下。如果是你关心的人说\"" + criticism + "\"，你会怎么回他？你会说你不够好吗？还是你会说——等一下，不是这样的，你只是……</p>",
    "<p>焦虑有一个习惯：它会把一个片段撑大，大到盖住你整个人。" + timeRef + "的事，它是" + timeRef + "的事。它不等于你是什么样的人。</p>" + sp + "<p>分开它们。不是今天之内。只是慢慢来。</p>",
    "<p>先不反驳它。只是看见它。看见它每次都在你受伤的时候跳出来。它可能曾经保护过你——用否定自己来避免被别人否定。但现在你不需要这种保护了。</p>",
  ]);
  var closes = shuffle([
    "<p>你可以拿出手机，在备忘录里打一行字：<strong>这是焦虑说的话，不等于实际情况。</strong>写完就关掉。不用再跟它对话了。</p>",
    "<p>你不需要今天就说服自己。只是从" + criticism + "到你\可能没你想的那么糟\"之间，还隔着很多可能性。先不急着跳到结论。</p>",
  ]);
  return [opens[0] + sp + mids[0] + sp + closes[0]];
}

// ═══ 回应形状 4: 柔软转移注意力 ═══
function buildSoftDeflect(d, timeRef, quote, sp) {
  var opens = shuffle([
    "<p>你说的我看到了。先不分析它。</p>",
    "<p>" + quote + "。嗯。今天不想给你拆开看。</p>",
  ]);
  var mids = shuffle([
    "<p>有时候一直想一件事情，是在试着控制它。好像想透了就不会再难受了。但有些东西不是靠想通的。是靠时间泡软的。</p>" + sp + "<p>今晚可以不做这件事。把它放在这里，你去做别的。明天再捡起来——它不会跑掉的。</p>",
    "<p>你在反复咀嚼，不是因为矫情。是因为你比很多人更认真，更想把事情做对。先肯定自己这一点。然后允许自己暂时不做对。今天就到这里。</p>" + sp + "<p>离开屏幕。去倒一杯水。慢慢喝。感觉水从喉咙下去。然后再决定要不要继续想。</p>",
    "<p>你的大脑在帮你工作，只是加班太久了。让它休息。不是赶它走，是跟它说：辛苦了，我接手，你去旁边坐一会儿。</p>",
  ]);
  var closes = shuffle([
    "<p>今晚不需要想通。能睡着就已经是赢了。</p>",
    "<p>很多事情第二天起来，会比昨晚小很多。不是它变了，是你休息过了。</p>",
    "<p>先停在这里。不做总结。不给自己布置作业。</p>",
  ]);
  return [opens[0] + sp + mids[0] + sp + closes[0]];
}

// ═══ 回应形状 5: 人际关系 ═══
function buildRelationshipResponse(d, timeRef, personRef, quote, sp) {
  var person = personRef || "对方";
  var opens = shuffle([
    "<p>" + quote + "——" + person + "的反应，你到现在还在想。这种反复扫描是高敏感的人很常见的反应。不是你的问题。</p>",
    "<p>嗯。" + timeRef + "和" + person + "的事。</p>",
  ]);
  var mids = shuffle([
    "<p>一个人的一句话、一次回复、一个表情——它只是那一刻的切片。不够定义你，也不够判断你们整个关系。你现在只是被刺痛了，不是被判定了。</p>" + sp + "<p>你不需要在今天之内弄懂" + person + "在想什么。不知道也可以。给彼此一点时间。</p>",
    "<p>人的沟通有很多层。" + person + "当时的回复可能和你无关——也许是对方忙，也许对方也在想自己的事，也许你听到的语气只是你自己投射的担心。" + sp + "<p>分开来看：事实是对方回了什么（客观的一句话）。解读是你觉得这意味着什么（可能被拒绝/被讨厌）。两者不一样。</p>",
  ]);
  var closes = shuffle([
    "<p>先给自己 24 小时。24 小时后如果还在想，那时候再处理。今天的目标不是想通，是让自己不被这件事占满。</p>",
    "<p>你现在需要的可能不是答案，是先把这份担心从肩膀上拿下来一会儿。然后再说。</p>",
  ]);
  return [opens[0] + sp + mids[0] + sp + closes[0]];
}

// ═══ 回应形状 6: 简短温暖 ═══
function buildShortWarm(d, timeRef, quote, sp) {
  var pool = shuffle([
    "<p>" + quote + "——嗯，听到了。</p>" + sp + "<p>不用急着处理它。先知道有人听到了。不是所有情绪都要立刻被解决。有些就只是需要被见证。</p>" + sp + "<p>先不用忙着变好。先在这里待一会儿。</p>",
    "<p>谢谢你写出来。不是所有难受都能被组织成完整的句子，但你做了。这本身就是一步。</p>" + sp + "<p>今天不需要得出结论。你只需要知道自己不是一个人在想这件事。</p>" + sp + "<p>可以先放一放。不是逃避，是给自己一个呼吸的间隙。</p>",
    "<p>" + timeRef + "的事，到现在还在你脑子里。这种感觉很重，我知道。</p>" + sp + "<p>先不对抗它。就像水里有沙，你越搅越浑。先不动。让它自己沉一沉。不是说事情不重要——是说你比事情更重要。</p>",
  ]);
  return [pool[0]];
}

// ═══ 回应形状 7: 两段式 ═══
function buildTwoPart(d, timeRef, quote, sp) {
  var opens = shuffle([
    "<p>你说的我看了两遍。</p><p>" + quote + "</p>",
    "<p>嗯。这件事让你难受，不是因为它小，是因为它碰到了你在意的地方。</p>",
    "<p>" + timeRef + "发生的事，现在还在转。那种感觉我懂。</p>",
  ]);
  var closes = shuffle([
    "<p>现在有一个很小的事可以做：把手放在胸口，只是放上去。感觉到心跳。什么都不用做。让它知道你在这里。</p><p>然后去喝一杯水。慢慢喝。喝完再决定要不要继续想。</p>",
    "<p>你需要的话可以继续写。不需要的话就停在这里。都由你。</p>",
    "<p>不是所有的难受都需要分析。有时候只是需要被陪着。先坐一会儿。</p>",
    "<p>你可以敏感，也可以慢慢恢复。此刻不需要立刻变好。</p>",
  ]);
  return [opens[0] + sp + closes[0]];
}

// ═══ 回应形状 8: 结尾丢一个温和的问题 ═══
function buildQuestionEnd(d, timeRef, quote, sp) {
  var opens = shuffle([
    "<p>" + quote + "——嗯。你先说出来了，已经比憋着的时候好了很多。</p>",
    "<p>我听到了。你现在不是一个人在想这件事。</p>",
  ]);
  var mids = shuffle([
    "<p>有时候难受不是一下子来的，是好多件小事情慢慢堆起来的。" + timeRef + "可能只是最后一根稻草。那些之前没消化的东西，我们可以慢慢看。</p>",
    "<p>先不强迫自己想通。有时候越想越紧，反而是停下来、去做一件不动脑的事，答案自己浮出来。</p>",
  ]);
  var closes = shuffle([
    "<p>你有经常在哪里写写东西吗？备忘录？还是跟朋友说？</p>",
    "<p>如果现在让你给自己发一条语音微信，你会说什么？（不一定要发出去）</p>",
    "<p>除了这件事，今天还有什么让你稍微好一点的时刻吗？哪怕只是阳光照进来、或者喝到一杯不烫不凉的水。</p>",
  ]);
  return [opens[0] + sp + mids[0] + sp + closes[0]];
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
