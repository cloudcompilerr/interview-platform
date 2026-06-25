import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/* ==========================================================================
   Constants & default data
   ========================================================================== */

const STORAGE_KEYS = {
  session: 'ip_session_v1',
  domains: 'ip_domains_v2',
  interviews: 'ip_interviews_v2',
  settings: 'ip_settings_v1',
};

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

const RECOMMENDATION_OPTIONS = ['RECOMMEND', 'CONSIDER', 'REJECT'];
const RECOMMENDATION_LABELS = {
  RECOMMEND: 'Recommend',
  CONSIDER: 'Consider',
  REJECT: 'Reject',
};
const RECOMMENDATION_TONES = {
  RECOMMEND: 'success',
  CONSIDER: 'warning',
  REJECT: 'danger',
};

const STATUS_LABELS = { in_progress: 'In Progress', completed: 'Completed' };
const STATUS_TONES = { in_progress: 'info', completed: 'success' };

// Candidate seniority levels. Each question in the bank is tagged with one of
// these, and a New Interview pulls only the questions matching the selected
// level (plus the level-matched Behavioral & SDLC set — see BEHAVIORAL_DOMAIN_ID).
const LEVELS = [
  { id: 'fresher', label: 'Fresher (Final-Year Student)' },
  { id: 'entry', label: 'Entry-Level' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];
const LEVEL_LABELS = Object.fromEntries(LEVELS.map((l) => [l.id, l.label]));

// This domain's questions aren't a standalone interview choice — they're
// spliced into every interview alongside whichever technical domain is picked.
const BEHAVIORAL_DOMAIN_ID = 'behavioral-sdlc';

// Model used for "Collate with AI" — see collateFeedbackWithAI(). Swap this to
// 'claude-haiku-4-5' for a much cheaper/faster result on this lightweight
// formatting task; defaults to Opus for best quality.
const CLAUDE_MODEL_ID = 'claude-opus-4-8';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'new', label: 'New Interview' },
  { id: 'questions', label: 'Question Bank' },
  { id: 'data', label: 'Data & Reports' },
  { id: 'settings', label: 'Settings' },
];

// Each question carries a `level` (see LEVELS) and a `referenceAnswer` — a
// short model answer so an interviewer can judge a response even outside
// their own domain expertise.
const DEFAULT_DOMAINS = [
  {
    id: 'computer-vision',
    name: 'Computer Vision',
    questions: [
      {
        id: 'cv-fresher-1',
        level: 'fresher',
        text: 'What is the difference between a grayscale image and an RGB image, in terms of how they are stored as arrays?',
        referenceAnswer:
          'Grayscale is a single 2D matrix — one intensity value per pixel (0-255 for 8-bit). RGB is a 3D array (height x width x 3 channels) holding Red, Green, and Blue intensity separately; combining the channels produces the perceived color. A grayscale image needs roughly a third of the storage of an uncompressed RGB image.',
      },
      {
        id: 'cv-fresher-2',
        level: 'fresher',
        text: 'What does a convolution operation do in a CNN, intuitively?',
        referenceAnswer:
          'A small filter (kernel) slides over the image computing a weighted sum of the pixels it overlaps, producing one output value per position. This detects local patterns like edges or textures regardless of where they appear in the image, because the same weights are reused everywhere (translation invariance).',
      },
      {
        id: 'cv-fresher-3',
        level: 'fresher',
        text: 'Why do we normalize pixel values before feeding images into a neural network?',
        referenceAnswer:
          'Raw pixel values (0-255) are on a much larger, less consistent scale than typical weight initializations expect. Normalizing (e.g. to [0,1] or using mean/std normalization) speeds up convergence, helps prevent exploding or vanishing gradients, and makes learning-rate tuning more predictable.',
      },
      {
        id: 'cv-entry-1',
        level: 'entry',
        text: 'Explain the difference between object detection and image segmentation. When would you use each?',
        referenceAnswer:
          'Object detection draws bounding boxes with a class label per object instance — good when you need "what and roughly where". Segmentation (semantic or instance) labels every pixel — needed when precise boundaries matter, e.g. medical imaging or lane detection.',
      },
      {
        id: 'cv-entry-2',
        level: 'entry',
        text: 'What is data augmentation, and name three techniques you would use for an image classification task?',
        referenceAnswer:
          'Synthetic variation of training data to improve generalization without collecting more data. Techniques: random crop/flip, rotation, color jitter/brightness changes, cutout/mixup, and adding noise.',
      },
      {
        id: 'cv-entry-3',
        level: 'entry',
        text: 'Walk through a typical CNN architecture for image classification, from input to output.',
        referenceAnswer:
          'Input image, then stacked Conv + ReLU + Pool blocks that extract increasingly abstract features, then a flatten or global-average-pool step, then one or more fully connected layers, then a softmax over class scores. Modern nets add batch norm and skip connections for stability and depth.',
      },
      {
        id: 'cv-intermediate-1',
        level: 'intermediate',
        text: 'How would you handle a dataset with severe class imbalance in an image classification task?',
        referenceAnswer:
          'Class-weighted loss, oversampling the minority class or undersampling the majority, focal loss, targeted augmentation on minority classes, stratified sampling, and evaluating with F1/PR-AUC instead of raw accuracy.',
      },
      {
        id: 'cv-intermediate-2',
        level: 'intermediate',
        text: 'Explain transfer learning and when you would fine-tune all layers versus freeze the backbone.',
        referenceAnswer:
          'Reuse a model pretrained on a large dataset (e.g. ImageNet) as a feature extractor. Freeze the backbone and train only the head when the target dataset is small or similar in domain; fine-tune more or all layers when there is more data or the domain differs significantly, so low-level features adapt too.',
      },
      {
        id: 'cv-intermediate-3',
        level: 'intermediate',
        text: 'What is the difference between anchor-based and anchor-free object detectors?',
        referenceAnswer:
          'Anchor-based detectors (e.g. Faster R-CNN, YOLOv3) predefine boxes of various scales/ratios at each location and regress offsets — mature and accurate but more hyperparameters. Anchor-free detectors (e.g. CenterNet, FCOS) predict object centers or keypoints directly — simpler and often faster, with fewer hyperparameters to tune.',
      },
      {
        id: 'cv-advanced-1',
        level: 'advanced',
        text: 'Describe a time you had to optimize a computer vision model for inference speed on edge devices.',
        referenceAnswer:
          'Look for: model compression (quantization, pruning), an efficient architecture (MobileNet/EfficientNet-lite), knowledge distillation, operator fusion, a fast runtime (TensorRT, ONNX Runtime, TFLite), profiling to find the actual bottleneck rather than guessing, and a measured before/after latency or FPS number.',
      },
      {
        id: 'cv-advanced-2',
        level: 'advanced',
        text: 'How would you debug a model that performs well on validation but poorly in production?',
        referenceAnswer:
          'Look for train/serve skew (different preprocessing), distribution shift (different camera, lighting, or demographics in production vs. the validation set), label leakage in validation, data drift over time, and a plan to add production monitoring or shadow evaluation.',
      },
      {
        id: 'cv-advanced-3',
        level: 'advanced',
        text: 'Explain how Non-Maximum Suppression (NMS) works, and a limitation of it.',
        referenceAnswer:
          'NMS keeps the highest-confidence box in a cluster of overlapping boxes (IoU above a threshold) and suppresses the rest. Limitation: it can suppress genuinely separate, overlapping objects in crowded scenes; alternatives include Soft-NMS or detectors like DETR that need no NMS at all.',
      },
      {
        id: 'cv-expert-1',
        level: 'expert',
        text: 'How would you design a CV system that needs to keep improving post-deployment without full retraining cycles?',
        referenceAnswer:
          'Look for: active learning / human-in-the-loop labeling for hard examples, a continual fine-tuning pipeline, drift monitoring, canary or shadow deployments, a feedback loop from production errors back into the training set, and versioned datasets/models.',
      },
      {
        id: 'cv-expert-2',
        level: 'expert',
        text: 'Discuss the trade-offs between two-stage and single-stage detectors at scale, and how you would choose for a high-throughput production system.',
        referenceAnswer:
          'Two-stage (Faster R-CNN family): higher accuracy, especially on small or dense objects, but slower. Single-stage (YOLO/SSD family): faster, simpler pipeline, better for real-time, historically weaker on small objects though modern variants close the gap. The choice depends on the latency budget, object density, and whether accuracy or throughput dominates the SLA.',
      },
      {
        id: 'cv-expert-3',
        level: 'expert',
        text: 'How would you approach a vision foundation model strategy for a company with many downstream CV tasks (detection, segmentation, classification)?',
        referenceAnswer:
          'Look for: a shared self-supervised pretrained backbone (e.g. DINO, CLIP, SAM-style) with lightweight task-specific heads, reasoning about the compute/cost trade-off of fine-tuning per task vs. one shared backbone, a data flywheel strategy, and awareness of licensing/cost trade-offs of foundation models vs. training in-house.',
      },
    ],
  },
  {
    id: 'generative-ai',
    name: 'Generative AI',
    questions: [
      {
        id: 'genai-fresher-1',
        level: 'fresher',
        text: 'In simple terms, what is a Large Language Model (LLM), and how is it different from a traditional rule-based chatbot?',
        referenceAnswer:
          'An LLM is a neural network trained on huge amounts of text to predict the next token, learning patterns and knowledge statistically rather than from hand-written rules. This lets it generalize to inputs it has never seen, unlike a rule-based system limited to its programmed patterns.',
      },
      {
        id: 'genai-fresher-2',
        level: 'fresher',
        text: 'What is a "prompt", and why does the wording of a prompt affect the output?',
        referenceAnswer:
          'A prompt is the input text given to the model. Because the model predicts continuations based on patterns learned during training, small wording changes shift the probability distribution over likely completions — clearer instructions, examples, or context steer it toward the desired output.',
      },
      {
        id: 'genai-fresher-3',
        level: 'fresher',
        text: 'What does "hallucination" mean in the context of generative AI?',
        referenceAnswer:
          'When a model generates plausible-sounding but factually incorrect or fabricated information, stated confidently. It happens because the model optimizes for fluent, likely-sounding text, not verified truth.',
      },
      {
        id: 'genai-entry-1',
        level: 'entry',
        text: 'Explain how transformer attention mechanisms work, at a high level.',
        referenceAnswer:
          'Self-attention lets each token look at every other token in the sequence and compute a weighted relevance score (via query/key/value vectors), letting the model capture long-range dependencies without the sequential bottleneck of RNNs.',
      },
      {
        id: 'genai-entry-2',
        level: 'entry',
        text: 'What is the difference between fine-tuning and prompt engineering?',
        referenceAnswer:
          "Prompt engineering changes only the input/instructions to steer a frozen model's behavior — fast, cheap, no training needed. Fine-tuning updates the model's weights on task-specific data — a more durable behavior change, but it needs data, compute, and careful evaluation to avoid regressions.",
      },
      {
        id: 'genai-entry-3',
        level: 'entry',
        text: "What's the role of temperature and top-p in text generation?",
        referenceAnswer:
          'Both control randomness when sampling the next token. Temperature scales the probability distribution (lower is more deterministic/focused, higher is more random/creative). Top-p (nucleus sampling) restricts sampling to the smallest set of tokens whose cumulative probability exceeds p, trimming the unlikely long tail.',
      },
      {
        id: 'genai-intermediate-1',
        level: 'intermediate',
        text: 'What is the difference between fine-tuning, RAG, and prompt engineering? When would you choose each?',
        referenceAnswer:
          'Prompt engineering for quick behavior changes with no new data; RAG (Retrieval-Augmented Generation) when the model needs up-to-date or proprietary knowledge without retraining — retrieve relevant documents and inject them into the prompt; fine-tuning when consistent style, format, or behavior needs to be baked into the model and there is enough quality training data.',
      },
      {
        id: 'genai-intermediate-2',
        level: 'intermediate',
        text: 'How would you mitigate hallucinations in a production LLM application?',
        referenceAnswer:
          'Ground responses with retrieval (RAG) and citations, constrain the output format, use lower temperature for factual tasks, add a verification or grounding pass that checks claims against sources, and design the UX to make uncertainty visible to users.',
      },
      {
        id: 'genai-intermediate-3',
        level: 'intermediate',
        text: 'What is the difference between encoder-only, decoder-only, and encoder-decoder transformer architectures? Give an example use case for each.',
        referenceAnswer:
          'Encoder-only (e.g. BERT) suits understanding tasks like classification or embeddings. Decoder-only (e.g. the GPT family) suits open-ended generation. Encoder-decoder (e.g. T5, the original Transformer) suits sequence-to-sequence tasks like translation or summarization where input and output are distinct sequences.',
      },
      {
        id: 'genai-advanced-1',
        level: 'advanced',
        text: 'Describe how you would evaluate the quality of a generative AI system before shipping it.',
        referenceAnswer:
          'A combination of automatic metrics (task-specific: BLEU/ROUGE for summarization, exact-match for QA, or an LLM-as-judge rubric), human evaluation on a representative sample, red-teaming for safety/hallucination/bias, and post-launch guardrail metrics like latency, cost per request, and refusal rate.',
      },
      {
        id: 'genai-advanced-2',
        level: 'advanced',
        text: 'How would you design a RAG pipeline to keep answers grounded and reduce hallucination at scale?',
        referenceAnswer:
          'Look for: a deliberate chunking strategy, embedding model choice, hybrid search (vector + keyword), re-ranking retrieved chunks, citing sources in the response, a fallback for low-confidence retrieval ("I don\'t know" rather than guessing), and periodic re-indexing as the knowledge base changes.',
      },
      {
        id: 'genai-advanced-3',
        level: 'advanced',
        text: 'What are the trade-offs of a smaller fine-tuned model versus a large general-purpose model with good prompting, for a specific production task?',
        referenceAnswer:
          'A smaller fine-tuned model gives lower latency/cost at scale and more consistency on the narrow task, but needs labeled data and retraining as requirements evolve. A large general model with prompting is faster to iterate and needs no training infrastructure, but costs more per call and is less predictable on edge cases unless heavily prompt-engineered.',
      },
      {
        id: 'genai-expert-1',
        level: 'expert',
        text: 'How would you architect an LLM-based system that needs to operate reliably under rate limits, partial outages, or model deprecations from the provider?',
        referenceAnswer:
          'Look for: a provider/model abstraction layer with a fallback chain, request queuing with backoff and jitter, caching of repeated queries, graceful degradation to simpler logic when the model is unavailable, and monitoring for silent quality regressions after a provider-side model update.',
      },
      {
        id: 'genai-expert-2',
        level: 'expert',
        text: 'Discuss the trade-offs between a multi-agent system and a single well-prompted model for a complex task.',
        referenceAnswer:
          'A multi-agent system can decompose complex tasks, specialize prompts/tools per sub-task, and parallelize work — at the cost of orchestration complexity, higher latency/cost from multiple calls, and harder debugging of emergent failures. A single model is simpler and cheaper but may struggle with tasks needing very different "modes" of reasoning or tool use in sequence.',
      },
      {
        id: 'genai-expert-3',
        level: 'expert',
        text: 'How would you think about cost, latency, and quality trade-offs when choosing between a frontier model and a smaller, cheaper model for different parts of a product?',
        referenceAnswer:
          'Look for: a routing strategy where a cheap model handles easy/high-volume requests and a frontier model handles complex/high-stakes ones, caching and batching to cut cost, measuring the quality delta with real user feedback rather than assumption, and being explicit about which SLA — latency budget, cost ceiling, accuracy bar — is driving the choice for each surface.',
      },
    ],
  },
  {
    id: BEHAVIORAL_DOMAIN_ID,
    name: 'Behavioral & SDLC',
    questions: [
      {
        id: 'beh-fresher-1',
        level: 'fresher',
        text: 'Tell me about a project — academic, personal, or an internship — you are proud of. What was your specific contribution?',
        referenceAnswer:
          "Look for clear ownership of a specific piece (not just \"we built X\"), a real technical or design decision they made themselves, and genuine understanding of why it worked.",
      },
      {
        id: 'beh-fresher-2',
        level: 'fresher',
        text: 'Have you used version control such as Git before? Walk me through how you would commit and share a change with a team.',
        referenceAnswer:
          'Look for basic familiarity: clone or branch, commit with a message, push, open a pull request. Bonus for understanding why small, frequent commits and descriptive messages matter for collaboration.',
      },
      {
        id: 'beh-fresher-3',
        level: 'fresher',
        text: 'Describe a time you got stuck on a bug or problem. What did you do?',
        referenceAnswer:
          'Look for a real debugging process — isolating the issue, reading error messages or logs, searching documentation, asking for help appropriately — rather than giving up or guessing randomly, and what they learned from it.',
      },
      {
        id: 'beh-entry-1',
        level: 'entry',
        text: "Walk me through your team's code review process at your last role or internship.",
        referenceAnswer:
          'Look for understanding of why review matters (catching bugs, knowledge sharing, consistency) and a concrete habit, like keeping PRs small or responding to feedback without taking it personally.',
      },
      {
        id: 'beh-entry-2',
        level: 'entry',
        text: "Tell me about a time you disagreed with a teammate's technical decision. How did you handle it?",
        referenceAnswer:
          'Look for respectful disagreement, bringing data or reasoning rather than just opinion, willingness to be wrong, and a real resolution — escalation, compromise, or being convinced.',
      },
      {
        id: 'beh-entry-3',
        level: 'entry',
        text: 'How do you prioritize your tasks when you have more to do than time allows?',
        referenceAnswer:
          'Look for a real method — impact vs. effort, deadlines, asking the manager or PM when unsure — rather than "I just do everything", and self-awareness about the trade-offs made.',
      },
      {
        id: 'beh-intermediate-1',
        level: 'intermediate',
        text: 'Describe a production incident you were involved in. What was the root cause, and what did you change afterward?',
        referenceAnswer:
          'Look for ownership (not just blaming others), a clear root cause rather than just the symptom, and a concrete follow-up action — a post-mortem, added monitoring, an added test, or a process change — not just "we fixed it and moved on".',
      },
      {
        id: 'beh-intermediate-2',
        level: 'intermediate',
        text: 'How do you approach writing tests for a feature you are building? What does your testing pyramid look like?',
        referenceAnswer:
          "Look for a sensible mix — more unit tests, fewer integration, fewest end-to-end — reasoning about what's worth testing (business logic, edge cases) vs. not (trivial getters), and awareness of the maintenance cost of tests.",
      },
      {
        id: 'beh-intermediate-3',
        level: 'intermediate',
        text: 'Tell me about a time you had to push back on a deadline or scope. How did that conversation go?',
        referenceAnswer:
          'Look for clear communication of trade-offs backed by data (not just "it\'s hard"), proposing alternatives like reduced scope or phased delivery, and a professional, collaborative tone rather than simply refusing.',
      },
      {
        id: 'beh-advanced-1',
        level: 'advanced',
        text: 'Describe how you have mentored a junior engineer or onboarded a new team member. What worked, and what did not?',
        referenceAnswer:
          "Look for concrete actions — pairing, structured onboarding docs, regular check-ins — self-reflection on what didn't work and how they adjusted, and genuine investment in the other person's growth rather than just task delegation.",
      },
      {
        id: 'beh-advanced-2',
        level: 'advanced',
        text: 'Tell me about a time you had to make an architectural decision with incomplete information. How did you decide, and would you decide differently now?',
        referenceAnswer:
          'Look for a real decision-making framework — weighing reversibility, cost of being wrong, time pressure — intellectual honesty about the outcome, and learning that was actually applied to later decisions.',
      },
      {
        id: 'beh-advanced-3',
        level: 'advanced',
        text: 'How do you balance technical debt against feature delivery pressure on your team?',
        referenceAnswer:
          'Look for a pragmatic approach — not "always pay it down" or "always ship features" — with examples of negotiating time for debt paydown, tying debt to concrete risk or cost, and communicating the trade-off to non-technical stakeholders.',
      },
      {
        id: 'beh-expert-1',
        level: 'expert',
        text: 'Describe a time you had to drive a cross-team technical decision where stakeholders disagreed. How did you reach alignment?',
        referenceAnswer:
          'Look for stakeholder management skill, framing the decision around shared goals and data rather than authority, and a real outcome — including how they handled people who remained unconvinced.',
      },
      {
        id: 'beh-expert-2',
        level: 'expert',
        text: 'How do you think about building a culture of engineering quality — testing, code review, incident response — across a growing organization?',
        referenceAnswer:
          'Look for systems thinking beyond their own team — examples of process or tooling they introduced organization-wide, how they got buy-in, and how they measured whether it actually improved outcomes, not just "we added a policy".',
      },
      {
        id: 'beh-expert-3',
        level: 'expert',
        text: 'Tell me about the hardest engineering trade-off you have had to defend to leadership. What was at stake, and how did you make your case?',
        referenceAnswer:
          'Look for the ability to translate technical risk into business terms, genuinely high stakes rather than a trivial example, and composure and clarity under pushback from non-technical leadership.',
      },
    ],
  },
];

/* ==========================================================================
   Pure utility helpers
   ========================================================================== */

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function average(numbers) {
  const valid = (numbers || []).filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

function formatScore(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(1);
}

function slugify(text) {
  const slug = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'interview';
}

function byteSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return JSON.stringify(value).length;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    console.error(`Failed to load "${key}" from localStorage:`, error);
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save "${key}" to localStorage:`, error);
    return false;
  }
}

function mergeById(existing, incoming) {
  const map = new Map((existing || []).map((item) => [item.id, item]));
  (incoming || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function downloadFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildInterview({ candidateName, interviewer, date, notes, domain, level, behavioralDomain }) {
  const technicalQuestions = domain.questions.filter((q) => q.level === level);
  const behavioralQuestions = (behavioralDomain?.questions || []).filter((q) => q.level === level);
  const responses = [...technicalQuestions, ...behavioralQuestions].map((q) => ({
    questionId: q.id,
    questionText: q.text,
    referenceAnswer: q.referenceAnswer || '',
    response: '',
    rating: null,
  }));

  return {
    id: generateId(),
    candidateName,
    domainId: domain.id,
    domainName: domain.name,
    level,
    levelLabel: LEVEL_LABELS[level] || level,
    interviewer: interviewer || 'Unspecified',
    date,
    notes: notes || '',
    status: 'in_progress',
    responses,
    technicalScore: null,
    behavioralScore: null,
    sdlcScore: null,
    overallAssessment: '',
    feedbackBullets: '',
    recommendation: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
  };
}

// Deterministic, offline fallback for turning shorthand bullet notes into a
// readable paragraph — used whenever the AI collation path is unavailable.
function formatBulletsToParagraph(bulletText) {
  const points = String(bulletText || '')
    .split('\n')
    .map((line) => line.replace(/^[\s*\-•]+/, '').trim())
    .filter(Boolean);
  if (!points.length) return '';
  return points
    .map((point) => {
      const capitalized = point.charAt(0).toUpperCase() + point.slice(1);
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    })
    .join(' ');
}

// Calls the Claude API directly from the browser (bring-your-own API key,
// stored only in this browser's localStorage) to turn interviewer bullet
// notes into a coherent overall-assessment paragraph. Callers must catch and
// fall back to formatBulletsToParagraph() — this throws on any failure
// (no key, offline, rate limit, network error, etc.) by design, since the
// feature must never block completing an interview.
//
// Uses a plain fetch() call rather than @anthropic-ai/sdk: the SDK's
// credential-resolution code does a dynamic `import('node:fs')`, which
// Create React App's stock Webpack 5 config can't bundle without ejecting or
// adding extra build tooling — not worth it for one optional convenience
// feature. anthropic-dangerous-direct-browser-access is the documented
// opt-in header for calling the Messages API directly from a browser.
async function collateFeedbackWithAI(bulletText, apiKey) {
  if (!apiKey) throw new Error('No Anthropic API key configured.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL_ID,
      max_tokens: 600,
      output_config: { effort: 'low' },
      system:
        "You write a candidate interview assessment paragraph from an interviewer's shorthand bullet notes. " +
        'Use only the information in the notes — do not invent facts, scores, or details not present. ' +
        'Write 3-6 sentences of plain prose, professional and specific, with no headings, bullets, or markdown.',
      messages: [{ role: 'user', content: String(bulletText || '').trim() }],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error?.message || `Claude API request failed (${res.status}).`);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw new Error('The request was declined.');
  }
  const textBlock = (data.content || []).find((block) => block.type === 'text');
  const text = textBlock?.text?.trim();
  if (!text) throw new Error('Empty response from the API.');
  return text;
}

function buildTxtReport(interview) {
  const divider = '='.repeat(60);
  const sub = '-'.repeat(60);
  const avgRating = average(interview.responses.map((r) => r.rating));
  const overall = average([interview.technicalScore, interview.behavioralScore, interview.sdlcScore]);
  const lines = [];

  lines.push(divider, 'INTERVIEW ASSESSMENT REPORT', divider, '');
  lines.push(`Candidate:    ${interview.candidateName}`);
  lines.push(`Domain:       ${interview.domainName}`);
  lines.push(`Level:        ${interview.levelLabel || interview.level || '—'}`);
  lines.push(`Interviewer:  ${interview.interviewer || '—'}`);
  lines.push(`Date:         ${formatDate(interview.date)}`);
  lines.push(`Status:       ${STATUS_LABELS[interview.status] || interview.status}`);
  lines.push('', sub, 'QUESTIONS & RESPONSES', sub);

  interview.responses.forEach((r, idx) => {
    lines.push('', `${idx + 1}. ${r.questionText}`);
    lines.push(`   Response:          ${r.response ? r.response : '(no response recorded)'}`);
    lines.push(`   Rating:            ${r.rating ? `${r.rating}/10` : 'Not rated'}`);
    if (r.referenceAnswer) {
      lines.push(`   Reference Answer:  ${r.referenceAnswer}`);
    }
  });

  lines.push('', sub, 'SCORES', sub);
  lines.push(`Technical Score:          ${formatScore(interview.technicalScore)}/10`);
  lines.push(`Behavioral Score:         ${formatScore(interview.behavioralScore)}/10`);
  lines.push(`SDLC Score:               ${formatScore(interview.sdlcScore)}/10`);
  lines.push(`Average Question Rating:  ${formatScore(avgRating)}/10`);
  lines.push(`Overall Score:            ${formatScore(overall)}/10`);

  lines.push('', sub, 'OVERALL ASSESSMENT', sub);
  lines.push(interview.overallAssessment || '(no assessment notes recorded)');

  lines.push('', sub, `RECOMMENDATION: ${interview.recommendation || 'PENDING'}`, sub, '');
  lines.push(`Generated by Interview Platform on ${formatDateTime(nowIso())}`);

  return lines.join('\n');
}

function buildCsvReport(interview) {
  const rows = [];
  rows.push(['Field', 'Value']);
  rows.push(['Candidate', interview.candidateName]);
  rows.push(['Domain', interview.domainName]);
  rows.push(['Level', interview.levelLabel || interview.level || '']);
  rows.push(['Interviewer', interview.interviewer || '']);
  rows.push(['Date', interview.date || '']);
  rows.push(['Status', STATUS_LABELS[interview.status] || interview.status]);
  rows.push(['Technical Score', interview.technicalScore ?? '']);
  rows.push(['Behavioral Score', interview.behavioralScore ?? '']);
  rows.push(['SDLC Score', interview.sdlcScore ?? '']);
  rows.push(['Overall Assessment', interview.overallAssessment || '']);
  rows.push(['Recommendation', interview.recommendation || '']);
  rows.push([]);
  rows.push(['#', 'Question', 'Response', 'Rating (1-10)', 'Reference Answer']);
  interview.responses.forEach((r, idx) => {
    rows.push([idx + 1, r.questionText, r.response || '', r.rating ?? '', r.referenceAnswer || '']);
  });
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function buildJsonReport(interview) {
  return JSON.stringify(interview, null, 2);
}

function buildBackupPayload(domains, interviews) {
  return {
    version: 1,
    exportedAt: nowIso(),
    domains,
    interviews,
  };
}

/* ==========================================================================
   Small presentational components
   ========================================================================== */

function Badge({ tone = 'neutral', children }) {
  return <span className={`ip-badge ip-badge-${tone}`}>{children}</span>;
}

function EmptyState({ title, body }) {
  return (
    <div className="ip-empty-state">
      <h3>{title}</h3>
      <p className="ip-text-muted">{body}</p>
    </div>
  );
}

function ToastBanner({ toast }) {
  if (!toast) return null;
  return (
    <div className={`ip-toast ip-toast-${toast.type}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Interview Platform crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="ip-login-screen">
          <div className="ip-login-card">
            <h1>Something went wrong</h1>
            <p className="ip-text-muted">
              An unexpected error occurred. Your saved data is untouched in localStorage — try again or refresh the page.
            </p>
            <button type="button" className="ip-btn ip-btn-primary ip-btn-block" onClick={this.handleReset}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <InterviewPlatform />
    </ErrorBoundary>
  );
}

/* ==========================================================================
   Login
   ========================================================================== */

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter any username and password to continue.');
      return;
    }
    setError('');
    onLogin(username.trim());
  }

  return (
    <div className="ip-login-screen">
      <div className="ip-login-card">
        <h1>Interview Platform</h1>
        <p className="ip-text-muted">Zero-cost, offline-first interview management.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="ip-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jordan.lee"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="ip-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="any password works"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="ip-form-error">{error}</p>}
          <button type="submit" className="ip-btn ip-btn-primary ip-btn-block">
            Sign In
          </button>
        </form>
        <p className="ip-login-note">
          Demo authentication — any username and password works. Nothing leaves this device.
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Navigation shell
   ========================================================================== */

function NavShell({ session, view, onNavigate, onLogout, mobileNavOpen, setMobileNavOpen, children }) {
  return (
    <div className="ip-app-shell">
      <div
        className={`ip-sidebar-backdrop ${mobileNavOpen ? 'ip-sidebar-backdrop-open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`ip-sidebar ${mobileNavOpen ? 'ip-sidebar-open' : ''}`}>
        <div className="ip-sidebar-header">
          <h2>Interview Platform</h2>
          <p className="ip-text-muted ip-small">Offline &middot; $0/month</p>
        </div>
        <nav className="ip-nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ip-nav-item ${view === item.id ? 'ip-nav-item-active' : ''}`}
              onClick={() => {
                onNavigate(item.id);
                setMobileNavOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ip-sidebar-footer">
          <p className="ip-small">
            Signed in as <strong>{session.username}</strong>
          </p>
          <button type="button" className="ip-btn ip-btn-ghost ip-btn-block ip-btn-sm" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </aside>
      <div className="ip-main-column">
        <header className="ip-topbar">
          <button
            type="button"
            className="ip-icon-btn"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            &#9776;
          </button>
          <strong>Interview Platform</strong>
        </header>
        <main className="ip-main">{children}</main>
      </div>
    </div>
  );
}

/* ==========================================================================
   Dashboard
   ========================================================================== */

function DashboardView({ session, domains, interviews, onNavigate, onResume, onViewReport }) {
  const stats = useMemo(() => {
    const completed = interviews.filter((iv) => iv.status === 'completed');
    const inProgress = interviews.filter((iv) => iv.status === 'in_progress');
    const byDomain = domains.map((domain) => ({
      domain,
      count: interviews.filter((iv) => iv.domainId === domain.id).length,
    }));
    const byRecommendation = RECOMMENDATION_OPTIONS.map((rec) => ({
      rec,
      count: completed.filter((iv) => iv.recommendation === rec).length,
    }));
    const overallScores = completed
      .map((iv) => average([iv.technicalScore, iv.behavioralScore, iv.sdlcScore]))
      .filter((n) => n !== null);
    const recent = [...interviews]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    return {
      total: interviews.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      byDomain,
      byRecommendation,
      averageOverallScore: average(overallScores),
      recent,
    };
  }, [domains, interviews]);

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Welcome back, {session.username}</h1>
          <p className="ip-text-muted">Here's how your interview pipeline looks today.</p>
        </div>
        <button type="button" className="ip-btn ip-btn-primary" onClick={() => onNavigate('new')}>
          New Interview
        </button>
      </div>

      <div className="ip-grid-stats">
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.total}</span>
          <span className="ip-stat-label">Total Interviews</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.completedCount}</span>
          <span className="ip-stat-label">Completed</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.inProgressCount}</span>
          <span className="ip-stat-label">In Progress</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(stats.averageOverallScore)}</span>
          <span className="ip-stat-label">Avg. Overall Score</span>
        </div>
      </div>

      <div className="ip-two-col">
        <div className="ip-card">
          <h3>Interviews by Domain</h3>
          {stats.byDomain.map(({ domain, count }) => (
            <div className="ip-bar-row" key={domain.id}>
              <span>{domain.name}</span>
              <span className="ip-text-muted">{count}</span>
            </div>
          ))}
        </div>
        <div className="ip-card">
          <h3>Recommendations (Completed)</h3>
          {stats.byRecommendation.map(({ rec, count }) => (
            <div className="ip-bar-row" key={rec}>
              <Badge tone={RECOMMENDATION_TONES[rec]}>{RECOMMENDATION_LABELS[rec]}</Badge>
              <span className="ip-text-muted">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ip-card">
        <h3>Recent Activity</h3>
        {stats.recent.length === 0 ? (
          <EmptyState
            title="No interviews yet"
            body="Start your first interview to see it show up here."
          />
        ) : (
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((iv) => (
                  <tr key={iv.id}>
                    <td>{iv.candidateName}</td>
                    <td>{iv.domainName}</td>
                    <td>
                      <Badge tone={STATUS_TONES[iv.status]}>{STATUS_LABELS[iv.status]}</Badge>
                    </td>
                    <td>{formatDateTime(iv.updatedAt)}</td>
                    <td className="ip-table-actions">
                      {iv.status === 'in_progress' ? (
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onResume(iv.id)}>
                          Continue
                        </button>
                      ) : (
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onViewReport(iv.id)}>
                          View Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   New Interview
   ========================================================================== */

function NewInterviewView({ domains, defaultInterviewer, onCreate, onCancel }) {
  const technicalDomains = useMemo(() => domains.filter((d) => d.id !== BEHAVIORAL_DOMAIN_ID), [domains]);
  const behavioralDomain = useMemo(() => domains.find((d) => d.id === BEHAVIORAL_DOMAIN_ID), [domains]);

  const [candidateName, setCandidateName] = useState('');
  const [domainId, setDomainId] = useState(technicalDomains[0]?.id || '');
  const [level, setLevel] = useState(LEVELS[1]?.id || LEVELS[0]?.id || '');
  const [interviewer, setInterviewer] = useState(defaultInterviewer || '');
  const [date, setDate] = useState(todayInputDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const domain = technicalDomains.find((d) => d.id === domainId);
  const questionCount =
    (domain?.questions.filter((q) => q.level === level).length || 0) +
    (behavioralDomain?.questions.filter((q) => q.level === level).length || 0);

  function handleSubmit(event) {
    event.preventDefault();
    if (!candidateName.trim()) {
      setError('Candidate name is required.');
      return;
    }
    if (!domain) {
      setError('Please select a domain.');
      return;
    }
    if (questionCount === 0) {
      setError(
        `No questions found for ${domain.name} at the ${LEVEL_LABELS[level]} level. Add some in the Question Bank first.`
      );
      return;
    }
    setError('');
    onCreate({
      candidateName: candidateName.trim(),
      domain,
      level,
      behavioralDomain,
      interviewer: interviewer.trim(),
      date,
      notes: notes.trim(),
    });
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>New Interview</h1>
          <p className="ip-text-muted">Set up a new interview session for a candidate.</p>
        </div>
      </div>
      <div className="ip-card ip-card-narrow">
        <form onSubmit={handleSubmit} noValidate>
          <div className="ip-field">
            <label htmlFor="ni-candidate">Candidate Name *</label>
            <input
              id="ni-candidate"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoFocus
            />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-domain">Domain *</label>
            <select id="ni-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {technicalDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="ni-level">Candidate Level *</label>
            <select id="ni-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="ip-small ip-text-muted">
              {questionCount} question{questionCount === 1 ? '' : 's'} will be used ({domain?.name || 'domain'} +
              Behavioral &amp; SDLC, both at this level).
            </p>
          </div>
          <div className="ip-field">
            <label htmlFor="ni-interviewer">Interviewer</label>
            <input
              id="ni-interviewer"
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-date">Date</label>
            <input id="ni-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-notes">Notes (optional)</label>
            <textarea
              id="ni-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context about this candidate or role..."
            />
          </div>
          {error && <p className="ip-form-error">{error}</p>}
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ip-btn ip-btn-primary">
              Start Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   Interview Session
   ========================================================================== */

function SessionView({ interview, onUpdateResponse, onUpdateInterview, onComplete, onGenerateAssessment, onBack }) {
  const [tab, setTab] = useState('questions');
  const [expandedRefs, setExpandedRefs] = useState(() => new Set());
  const [isCollating, setIsCollating] = useState(false);

  if (!interview) {
    return (
      <EmptyState title="Interview not found" body="It may have been deleted. Go back to the dashboard." />
    );
  }

  const answeredCount = interview.responses.filter((r) => r.rating !== null).length;

  function toggleReferenceAnswer(questionId) {
    setExpandedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  async function handleGenerateClick() {
    setIsCollating(true);
    try {
      const text = await onGenerateAssessment(interview.feedbackBullets);
      if (text !== null) {
        onUpdateInterview(interview.id, { overallAssessment: text });
      }
    } finally {
      setIsCollating(false);
    }
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>{interview.candidateName}</h1>
          <p className="ip-text-muted">
            {interview.domainName} &middot; {interview.levelLabel} &middot; Interviewer: {interview.interviewer}{' '}
            &middot; {formatDate(interview.date)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[interview.status]}>{STATUS_LABELS[interview.status]}</Badge>
      </div>

      <div className="ip-tabs">
        <button
          type="button"
          className={`ip-tab ${tab === 'questions' ? 'ip-tab-active' : ''}`}
          onClick={() => setTab('questions')}
        >
          Questions ({answeredCount}/{interview.responses.length} rated)
        </button>
        <button
          type="button"
          className={`ip-tab ${tab === 'assessment' ? 'ip-tab-active' : ''}`}
          onClick={() => setTab('assessment')}
        >
          Final Assessment
        </button>
      </div>

      {tab === 'questions' ? (
        <div>
          {interview.responses.map((r, idx) => (
            <div className="ip-question-card" key={r.questionId}>
              <p className="ip-question-text">
                {idx + 1}. {r.questionText}
              </p>
              <div className="ip-field">
                <label htmlFor={`resp-${r.questionId}`}>Candidate Response</label>
                <textarea
                  id={`resp-${r.questionId}`}
                  rows={3}
                  value={r.response}
                  onChange={(e) =>
                    onUpdateResponse(interview.id, r.questionId, { response: e.target.value })
                  }
                  placeholder="Record what the candidate said..."
                />
              </div>
              <div className="ip-field ip-field-inline">
                <label htmlFor={`rate-${r.questionId}`}>Rating</label>
                <select
                  id={`rate-${r.questionId}`}
                  value={r.rating ?? ''}
                  onChange={(e) =>
                    onUpdateResponse(interview.id, r.questionId, {
                      rating: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Not rated</option>
                  {RATING_VALUES.map((n) => (
                    <option key={n} value={n}>
                      {n}/10
                    </option>
                  ))}
                </select>
              </div>
              {r.referenceAnswer && (
                <>
                  <button
                    type="button"
                    className="ip-btn ip-btn-sm ip-btn-ghost"
                    onClick={() => toggleReferenceAnswer(r.questionId)}
                  >
                    {expandedRefs.has(r.questionId) ? 'Hide Reference Answer' : 'Show Reference Answer'}
                  </button>
                  {expandedRefs.has(r.questionId) && (
                    <p className="ip-reference-answer">{r.referenceAnswer}</p>
                  )}
                </>
              )}
            </div>
          ))}
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={onBack}>
              Back to Dashboard
            </button>
            <button type="button" className="ip-btn ip-btn-primary" onClick={() => setTab('assessment')}>
              Continue to Assessment
            </button>
          </div>
        </div>
      ) : (
        <div className="ip-card ip-card-narrow">
          <div className="ip-field">
            <label htmlFor="tech-score">Technical Score</label>
            <select
              id="tech-score"
              value={interview.technicalScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  technicalScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="beh-score">Behavioral Score</label>
            <select
              id="beh-score"
              value={interview.behavioralScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  behavioralScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="sdlc-score">SDLC Score</label>
            <select
              id="sdlc-score"
              value={interview.sdlcScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  sdlcScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="feedback-bullets">Feedback Notes (one point per line)</label>
            <textarea
              id="feedback-bullets"
              rows={4}
              value={interview.feedbackBullets}
              onChange={(e) => onUpdateInterview(interview.id, { feedbackBullets: e.target.value })}
              placeholder={'Jot down quick points as you go, e.g.\nstrong on system design tradeoffs\nstruggled to explain time complexity\ngood communication, asked clarifying questions'}
            />
            <button
              type="button"
              className="ip-btn ip-btn-secondary ip-btn-sm"
              onClick={handleGenerateClick}
              disabled={isCollating || !interview.feedbackBullets.trim()}
            >
              {isCollating ? 'Generating...' : 'Generate Assessment from Notes'}
            </button>
            <p className="ip-small ip-text-muted">
              Uses Claude when an API key is set in Settings and you're online; otherwise falls back to plain
              formatting automatically.
            </p>
          </div>
          <div className="ip-field">
            <label htmlFor="overall-assessment">Overall Assessment</label>
            <textarea
              id="overall-assessment"
              rows={4}
              value={interview.overallAssessment}
              onChange={(e) => onUpdateInterview(interview.id, { overallAssessment: e.target.value })}
              placeholder="Summarize strengths, gaps, and concerns... (or generate from notes above)"
            />
          </div>
          <div className="ip-field">
            <label htmlFor="recommendation">Recommendation</label>
            <select
              id="recommendation"
              value={interview.recommendation ?? ''}
              onChange={(e) => onUpdateInterview(interview.id, { recommendation: e.target.value || null })}
            >
              <option value="">Select recommendation</option>
              {RECOMMENDATION_OPTIONS.map((rec) => (
                <option key={rec} value={rec}>
                  {RECOMMENDATION_LABELS[rec]}
                </option>
              ))}
            </select>
          </div>
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={() => setTab('questions')}>
              Back to Questions
            </button>
            <button type="button" className="ip-btn ip-btn-primary" onClick={() => onComplete(interview.id)}>
              Complete Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Question Bank
   ========================================================================== */

function QuestionBankView({ domains, onAddQuestion, onDeleteQuestion }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id || '');
  const [newQuestion, setNewQuestion] = useState('');
  const [newLevel, setNewLevel] = useState(LEVELS[1]?.id || LEVELS[0]?.id || '');
  const [newReferenceAnswer, setNewReferenceAnswer] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) || domains[0];
  const visibleQuestions = selectedDomain
    ? selectedDomain.questions.filter((q) => levelFilter === 'all' || q.level === levelFilter)
    : [];

  function handleAdd(event) {
    event.preventDefault();
    if (!newQuestion.trim() || !selectedDomain) return;
    onAddQuestion(selectedDomain.id, {
      text: newQuestion.trim(),
      level: newLevel,
      referenceAnswer: newReferenceAnswer.trim(),
    });
    setNewQuestion('');
    setNewReferenceAnswer('');
  }

  function handleDelete(questionId) {
    if (window.confirm('Delete this question? This cannot be undone.')) {
      onDeleteQuestion(selectedDomain.id, questionId);
    }
  }

  if (!selectedDomain) {
    return <EmptyState title="No domains configured" body="Domains could not be loaded." />;
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Question Bank</h1>
          <p className="ip-text-muted">Manage interview questions for each domain and level.</p>
        </div>
      </div>

      <div className="ip-tabs">
        {domains.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`ip-tab ${selectedDomain.id === d.id ? 'ip-tab-active' : ''}`}
            onClick={() => setSelectedDomainId(d.id)}
          >
            {d.name} ({d.questions.length})
          </button>
        ))}
      </div>

      <div className="ip-card">
        <h3>Add a Question</h3>
        <form onSubmit={handleAdd}>
          <div className="ip-field">
            <label htmlFor="qb-text">Question</label>
            <textarea
              id="qb-text"
              rows={2}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder={`New question for ${selectedDomain.name}...`}
            />
          </div>
          <div className="ip-field ip-field-inline">
            <label htmlFor="qb-level">Level</label>
            <select id="qb-level" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="qb-reference">Reference Answer (optional, but helps non-expert interviewers)</label>
            <textarea
              id="qb-reference"
              rows={2}
              value={newReferenceAnswer}
              onChange={(e) => setNewReferenceAnswer(e.target.value)}
              placeholder="What should a strong answer cover?"
            />
          </div>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="submit" className="ip-btn ip-btn-primary">
              Add Question
            </button>
          </div>
        </form>
      </div>

      <div className="ip-card">
        <div className="ip-page-header">
          <h3>{selectedDomain.name} Questions</h3>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="ip-level-filter">
            <option value="all">All levels</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {visibleQuestions.length === 0 ? (
          <EmptyState title="No questions yet" body="Add your first question above." />
        ) : (
          visibleQuestions.map((q, idx) => (
            <div className="ip-question-card" key={q.id}>
              <div className="ip-question-card-compact">
                <p className="ip-question-text">
                  {idx + 1}. {q.text}
                </p>
                <div className="ip-table-actions">
                  <Badge tone="info">{LEVEL_LABELS[q.level] || q.level}</Badge>
                  <button type="button" className="ip-btn ip-btn-sm ip-btn-danger" onClick={() => handleDelete(q.id)}>
                    Delete
                  </button>
                </div>
              </div>
              {q.referenceAnswer && <p className="ip-reference-answer">{q.referenceAnswer}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Data Management
   ========================================================================== */

function DataView({ domains, interviews, onDeleteInterview, onViewReport, onResume, onExportAll, onImport }) {
  const fileInputRef = useRef(null);

  const stats = useMemo(() => {
    const domainsBytes = byteSize(domains);
    const interviewsBytes = byteSize(interviews);
    const questionCount = domains.reduce((sum, d) => sum + d.questions.length, 0);
    return {
      domainsBytes,
      interviewsBytes,
      totalBytes: domainsBytes + interviewsBytes,
      questionCount,
    };
  }, [domains, interviews]);

  const sortedInterviews = useMemo(
    () => [...interviews].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [interviews]
  );

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  }

  function handleDelete(interview) {
    if (window.confirm(`Delete the interview for ${interview.candidateName}? This cannot be undone.`)) {
      onDeleteInterview(interview.id);
    }
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Data & Reports</h1>
          <p className="ip-text-muted">View, export, back up and restore all interview data.</p>
        </div>
      </div>

      <div className="ip-two-col">
        <div className="ip-card">
          <h3>Storage Usage</h3>
          <div className="ip-bar-row">
            <span>Interviews</span>
            <span className="ip-text-muted">{interviews.length}</span>
          </div>
          <div className="ip-bar-row">
            <span>Domains</span>
            <span className="ip-text-muted">{domains.length}</span>
          </div>
          <div className="ip-bar-row">
            <span>Questions</span>
            <span className="ip-text-muted">{stats.questionCount}</span>
          </div>
          <div className="ip-bar-row">
            <span>Approx. localStorage used</span>
            <span className="ip-text-muted">{formatBytes(stats.totalBytes)}</span>
          </div>
          <p className="ip-small ip-text-muted">
            Browsers typically allow 5&ndash;10&nbsp;MB of localStorage per site &mdash; plenty for thousands of interviews.
          </p>
        </div>

        <div className="ip-card">
          <h3>Backup & Restore</h3>
          <p className="ip-text-muted">Export everything to a JSON file, or restore from a previous backup.</p>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="button" className="ip-btn ip-btn-primary" onClick={onExportAll}>
              Export All Data (JSON)
            </button>
            <button type="button" className="ip-btn ip-btn-secondary" onClick={handleImportClick}>
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
          <p className="ip-small ip-text-muted">
            Importing merges by ID &mdash; existing interviews and domains with matching IDs are updated, new ones are added.
          </p>
        </div>
      </div>

      <div className="ip-card">
        <h3>All Interviews</h3>
        {sortedInterviews.length === 0 ? (
          <EmptyState title="No interviews recorded" body="Create your first interview to see it here." />
        ) : (
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Domain</th>
                  <th>Level</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recommendation</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedInterviews.map((iv) => {
                  const overall = average([iv.technicalScore, iv.behavioralScore, iv.sdlcScore]);
                  return (
                    <tr key={iv.id}>
                      <td>{iv.candidateName}</td>
                      <td>{iv.domainName}</td>
                      <td>{iv.levelLabel || iv.level || '—'}</td>
                      <td>{formatDate(iv.date)}</td>
                      <td>
                        <Badge tone={STATUS_TONES[iv.status]}>{STATUS_LABELS[iv.status]}</Badge>
                      </td>
                      <td>
                        {iv.recommendation ? (
                          <Badge tone={RECOMMENDATION_TONES[iv.recommendation]}>
                            {RECOMMENDATION_LABELS[iv.recommendation]}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Pending</Badge>
                        )}
                      </td>
                      <td>{formatScore(overall)}</td>
                      <td className="ip-table-actions">
                        {iv.status === 'in_progress' ? (
                          <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onResume(iv.id)}>
                            Resume
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ip-btn ip-btn-sm ip-btn-secondary"
                            onClick={() => onViewReport(iv.id)}
                          >
                            Report
                          </button>
                        )}
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-danger" onClick={() => handleDelete(iv)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Report View
   ========================================================================== */

function ReportView({ interview, onDownloadTxt, onDownloadJson, onDownloadCsv, onBack, onDelete }) {
  if (!interview) {
    return <EmptyState title="Interview not found" body="It may have been deleted. Go back to the dashboard." />;
  }

  const avgRating = average(interview.responses.map((r) => r.rating));
  const overall = average([interview.technicalScore, interview.behavioralScore, interview.sdlcScore]);

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>{interview.candidateName}</h1>
          <p className="ip-text-muted">
            {interview.domainName} &middot; {interview.levelLabel} &middot; Interviewer: {interview.interviewer}{' '}
            &middot; {formatDate(interview.date)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[interview.status]}>{STATUS_LABELS[interview.status]}</Badge>
      </div>

      <div className="ip-form-actions ip-form-actions-start ip-no-print">
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadTxt(interview)}>
          Download TXT
        </button>
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadJson(interview)}>
          Download JSON
        </button>
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadCsv(interview)}>
          Download CSV
        </button>
      </div>

      <div className="ip-grid-stats">
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.technicalScore)}</span>
          <span className="ip-stat-label">Technical</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.behavioralScore)}</span>
          <span className="ip-stat-label">Behavioral</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.sdlcScore)}</span>
          <span className="ip-stat-label">SDLC</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(overall)}</span>
          <span className="ip-stat-label">Overall</span>
        </div>
      </div>

      <div className="ip-card">
        <h3>Recommendation</h3>
        {interview.recommendation ? (
          <Badge tone={RECOMMENDATION_TONES[interview.recommendation]}>
            {RECOMMENDATION_LABELS[interview.recommendation]}
          </Badge>
        ) : (
          <Badge tone="neutral">Pending</Badge>
        )}
      </div>

      <div className="ip-card">
        <h3>Overall Assessment</h3>
        <p>{interview.overallAssessment || 'No assessment notes recorded yet.'}</p>
      </div>

      <div className="ip-card">
        <h3>Questions & Responses (avg. rating {formatScore(avgRating)}/10)</h3>
        {interview.responses.map((r, idx) => (
          <div className="ip-question-card ip-question-card-compact" key={r.questionId}>
            <p className="ip-question-text">
              {idx + 1}. {r.questionText}
            </p>
            <p>{r.response || <span className="ip-text-muted">No response recorded.</span>}</p>
            <Badge tone="neutral">{r.rating ? `${r.rating}/10` : 'Not rated'}</Badge>
            {r.referenceAnswer && <p className="ip-reference-answer">Reference: {r.referenceAnswer}</p>}
          </div>
        ))}
      </div>

      <div className="ip-form-actions ip-no-print">
        <button type="button" className="ip-btn ip-btn-ghost" onClick={onBack}>
          Back to Dashboard
        </button>
        <button
          type="button"
          className="ip-btn ip-btn-danger"
          onClick={() => {
            if (window.confirm(`Delete the interview for ${interview.candidateName}? This cannot be undone.`)) {
              onDelete(interview.id);
            }
          }}
        >
          Delete Interview
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Settings
   ========================================================================== */

function SettingsView({ apiKey, onSaveApiKey, onClearApiKey }) {
  const [keyInput, setKeyInput] = useState(apiKey || '');

  function handleSave(event) {
    event.preventDefault();
    onSaveApiKey(keyInput.trim());
  }

  function handleClear() {
    setKeyInput('');
    onClearApiKey();
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Settings</h1>
          <p className="ip-text-muted">Optional AI assistance for collating interviewer feedback.</p>
        </div>
      </div>

      <div className="ip-card ip-card-narrow">
        <h3>Claude API Key</h3>
        <p className="ip-text-muted">
          When set, the "Generate Assessment from Notes" button in an interview session uses Claude to turn your
          bullet-point feedback into a polished paragraph. Without a key — or without an internet connection — it
          automatically falls back to simple offline formatting, so interviews are never blocked.
        </p>
        <form onSubmit={handleSave}>
          <div className="ip-field">
            <label htmlFor="settings-api-key">Anthropic API Key</label>
            <input
              id="settings-api-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </div>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="submit" className="ip-btn ip-btn-primary">
              Save Key
            </button>
            <button type="button" className="ip-btn ip-btn-ghost" onClick={handleClear}>
              Clear Key
            </button>
          </div>
        </form>
        <p className="ip-small ip-text-muted">
          {apiKey ? (
            <>
              <Badge tone="success">AI collation enabled</Badge> &mdash; this key is stored only in this browser's
              localStorage and is sent directly to Anthropic's API, never anywhere else.
            </>
          ) : (
            <>
              <Badge tone="neutral">AI collation disabled</Badge> &mdash; add a key above to enable it, or keep
              using the offline formatter.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Main application component
   ========================================================================== */

function InterviewPlatform() {
  const [session, setSession] = useState(() => safeLoad(STORAGE_KEYS.session, null));
  const [domains, setDomains] = useState(() => {
    const loaded = safeLoad(STORAGE_KEYS.domains, null);
    return loaded && Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_DOMAINS;
  });
  const [interviews, setInterviews] = useState(() => safeLoad(STORAGE_KEYS.interviews, []));
  const [settings, setSettings] = useState(() => safeLoad(STORAGE_KEYS.settings, { anthropicApiKey: '' }));
  const [view, setView] = useState('dashboard');
  const [activeInterviewId, setActiveInterviewId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    safeSave(STORAGE_KEYS.domains, domains);
  }, [domains]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.interviews, interviews);
  }, [interviews]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    if (session) {
      safeSave(STORAGE_KEYS.session, session);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.session);
      } catch (error) {
        console.error('Failed to clear session from localStorage:', error);
      }
    }
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const activeInterview = useMemo(
    () => interviews.find((iv) => iv.id === activeInterviewId) || null,
    [interviews, activeInterviewId]
  );

  const handleLogin = useCallback((username) => {
    setSession({ username, loginAt: nowIso() });
    setView('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    setActiveInterviewId(null);
    setView('dashboard');
  }, []);

  const handleNavigate = useCallback((targetView) => {
    setView(targetView);
  }, []);

  const handleCreateInterview = useCallback(
    (formData) => {
      const interview = buildInterview(formData);
      setInterviews((prev) => [interview, ...prev]);
      setActiveInterviewId(interview.id);
      setView('session');
      showToast(`Interview started for ${interview.candidateName}.`, 'success');
    },
    [showToast]
  );

  const handleUpdateResponse = useCallback((interviewId, questionId, patch) => {
    setInterviews((prev) =>
      prev.map((iv) =>
        iv.id !== interviewId
          ? iv
          : {
              ...iv,
              updatedAt: nowIso(),
              responses: iv.responses.map((r) => (r.questionId === questionId ? { ...r, ...patch } : r)),
            }
      )
    );
  }, []);

  const handleUpdateInterview = useCallback((interviewId, patch) => {
    setInterviews((prev) =>
      prev.map((iv) => (iv.id !== interviewId ? iv : { ...iv, ...patch, updatedAt: nowIso() }))
    );
  }, []);

  const handleCompleteInterview = useCallback(
    (interviewId) => {
      const interview = interviews.find((iv) => iv.id === interviewId);
      if (!interview) return;
      const missing = [];
      if (interview.technicalScore === null) missing.push('Technical Score');
      if (interview.behavioralScore === null) missing.push('Behavioral Score');
      if (interview.sdlcScore === null) missing.push('SDLC Score');
      if (!interview.recommendation) missing.push('Recommendation');
      if (!interview.overallAssessment || !interview.overallAssessment.trim()) missing.push('Overall Assessment');
      if (missing.length) {
        showToast(`Complete these fields before finishing: ${missing.join(', ')}.`, 'danger');
        return;
      }
      setInterviews((prev) =>
        prev.map((iv) =>
          iv.id === interviewId ? { ...iv, status: 'completed', completedAt: nowIso(), updatedAt: nowIso() } : iv
        )
      );
      setView('report');
      showToast('Interview completed and report generated.', 'success');
    },
    [interviews, showToast]
  );

  const handleDeleteInterview = useCallback(
    (interviewId) => {
      setInterviews((prev) => prev.filter((iv) => iv.id !== interviewId));
      setActiveInterviewId((prev) => (prev === interviewId ? null : prev));
      setView('data');
      showToast('Interview deleted.', 'info');
    },
    [showToast]
  );

  const handleResume = useCallback((interviewId) => {
    setActiveInterviewId(interviewId);
    setView('session');
  }, []);

  const handleViewReport = useCallback((interviewId) => {
    setActiveInterviewId(interviewId);
    setView('report');
  }, []);

  const handleAddQuestion = useCallback(
    (domainId, { text, level, referenceAnswer }) => {
      setDomains((prev) =>
        prev.map((d) =>
          d.id !== domainId
            ? d
            : { ...d, questions: [...d.questions, { id: generateId(), text, level, referenceAnswer }] }
        )
      );
      showToast('Question added.', 'success');
    },
    [showToast]
  );

  const handleDeleteQuestion = useCallback(
    (domainId, questionId) => {
      setDomains((prev) =>
        prev.map((d) => (d.id !== domainId ? d : { ...d, questions: d.questions.filter((q) => q.id !== questionId) }))
      );
      showToast('Question removed.', 'info');
    },
    [showToast]
  );

  const handleSaveApiKey = useCallback(
    (apiKey) => {
      setSettings((prev) => ({ ...prev, anthropicApiKey: apiKey }));
      showToast(apiKey ? 'API key saved. AI collation is now enabled.' : 'API key cleared.', 'success');
    },
    [showToast]
  );

  const handleClearApiKey = useCallback(() => {
    setSettings((prev) => ({ ...prev, anthropicApiKey: '' }));
    showToast('API key cleared. AI collation is disabled.', 'info');
  }, [showToast]);

  // Tries Claude first; on ANY failure (no key, offline, rate limit, server
  // error, etc.) falls back to the deterministic offline formatter so an
  // interview can always be completed. Returns null only when there were no
  // bullet notes to work with.
  const handleGenerateAssessment = useCallback(
    async (bulletText) => {
      if (!bulletText || !bulletText.trim()) {
        showToast('Add some feedback notes first.', 'danger');
        return null;
      }
      try {
        const text = await collateFeedbackWithAI(bulletText, settings.anthropicApiKey);
        showToast('Assessment drafted with Claude.', 'success');
        return text;
      } catch {
        showToast('AI unavailable right now — used offline formatting instead.', 'info');
        return formatBulletsToParagraph(bulletText);
      }
    },
    [settings.anthropicApiKey, showToast]
  );

  const handleExportAll = useCallback(() => {
    const payload = buildBackupPayload(domains, interviews);
    const ok = downloadFile(
      `interview-platform-backup-${todayInputDate()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast(ok ? 'Backup downloaded.' : 'Export failed.', ok ? 'success' : 'danger');
  }, [domains, interviews, showToast]);

  const handleImportBackup = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.domains) || !Array.isArray(parsed.interviews)) {
            throw new Error('Invalid backup file format.');
          }
          setDomains((prev) => mergeById(prev, parsed.domains));
          setInterviews((prev) => mergeById(prev, parsed.interviews));
          showToast(
            `Imported ${parsed.interviews.length} interview(s) and ${parsed.domains.length} domain(s).`,
            'success'
          );
        } catch (error) {
          console.error('Import failed:', error);
          showToast('Import failed: the file is not a valid backup.', 'danger');
        }
      };
      reader.onerror = () => showToast('Could not read the selected file.', 'danger');
      reader.readAsText(file);
    },
    [showToast]
  );

  const handleDownloadTxt = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.txt`, buildTxtReport(interview), 'text/plain');
  }, []);

  const handleDownloadJson = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.json`, buildJsonReport(interview), 'application/json');
  }, []);

  const handleDownloadCsv = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.csv`, buildCsvReport(interview), 'text/csv');
  }, []);

  if (!session) {
    return (
      <>
        <style>{APP_STYLES}</style>
        <LoginView onLogin={handleLogin} />
        <ToastBanner toast={toast} />
      </>
    );
  }

  let pageContent;
  switch (view) {
    case 'new':
      pageContent = (
        <NewInterviewView
          domains={domains}
          defaultInterviewer={session.username}
          onCreate={handleCreateInterview}
          onCancel={() => setView('dashboard')}
        />
      );
      break;
    case 'session':
      pageContent = (
        <SessionView
          interview={activeInterview}
          onUpdateResponse={handleUpdateResponse}
          onUpdateInterview={handleUpdateInterview}
          onComplete={handleCompleteInterview}
          onGenerateAssessment={handleGenerateAssessment}
          onBack={() => setView('dashboard')}
        />
      );
      break;
    case 'questions':
      pageContent = (
        <QuestionBankView domains={domains} onAddQuestion={handleAddQuestion} onDeleteQuestion={handleDeleteQuestion} />
      );
      break;
    case 'settings':
      pageContent = (
        <SettingsView
          apiKey={settings.anthropicApiKey}
          onSaveApiKey={handleSaveApiKey}
          onClearApiKey={handleClearApiKey}
        />
      );
      break;
    case 'data':
      pageContent = (
        <DataView
          domains={domains}
          interviews={interviews}
          onDeleteInterview={handleDeleteInterview}
          onViewReport={handleViewReport}
          onResume={handleResume}
          onExportAll={handleExportAll}
          onImport={handleImportBackup}
        />
      );
      break;
    case 'report':
      pageContent = (
        <ReportView
          interview={activeInterview}
          onDownloadTxt={handleDownloadTxt}
          onDownloadJson={handleDownloadJson}
          onDownloadCsv={handleDownloadCsv}
          onBack={() => setView('dashboard')}
          onDelete={handleDeleteInterview}
        />
      );
      break;
    default:
      pageContent = (
        <DashboardView
          session={session}
          domains={domains}
          interviews={interviews}
          onNavigate={handleNavigate}
          onResume={handleResume}
          onViewReport={handleViewReport}
        />
      );
  }

  return (
    <>
      <style>{APP_STYLES}</style>
      <NavShell
        session={session}
        view={view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      >
        {pageContent}
      </NavShell>
      <ToastBanner toast={toast} />
    </>
  );
}

/* ==========================================================================
   Inline component styles
   ========================================================================== */

const APP_STYLES = `
.ip-text-muted { color: var(--color-text-muted); }
.ip-small { font-size: 0.85rem; }

.ip-login-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #312e81 100%);
}
.ip-login-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 40px;
  max-width: 380px;
  width: 100%;
}
.ip-login-card h1 { font-size: 1.6rem; margin-bottom: 6px; }
.ip-login-card form { margin-top: 20px; }
.ip-login-note { margin-top: 18px; font-size: 0.82rem; color: var(--color-text-muted); text-align: center; }

.ip-field { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
.ip-field-inline { max-width: 200px; }
.ip-field label { font-size: 0.85rem; font-weight: 600; color: var(--color-text); }
.ip-field input,
.ip-field select,
.ip-field textarea {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  background: #fff;
  color: var(--color-text);
  width: 100%;
  resize: vertical;
}
.ip-field input:focus,
.ip-field select:focus,
.ip-field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}
.ip-form-error { color: var(--color-danger); font-size: 0.85rem; margin: 4px 0 12px; }
.ip-form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.ip-form-actions-start { justify-content: flex-start; flex-wrap: wrap; }
.ip-form-inline { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.ip-form-inline textarea { flex: 1; min-width: 220px; }

.ip-btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 18px;
  font-weight: 600;
  font-size: 0.92rem;
  transition: filter 0.15s ease, transform 0.05s ease;
  white-space: nowrap;
}
.ip-btn:active { transform: translateY(1px); }
.ip-btn-primary { background: var(--color-primary); color: #fff; }
.ip-btn-primary:hover { filter: brightness(1.08); }
.ip-btn-secondary { background: #eef2ff; color: var(--color-primary-dark); }
.ip-btn-secondary:hover { filter: brightness(0.97); }
.ip-btn-danger { background: #fef2f2; color: var(--color-danger); }
.ip-btn-danger:hover { filter: brightness(0.97); }
.ip-btn-ghost { background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); }
.ip-btn-ghost:hover { background: #f1f5f9; }
.ip-btn-block { width: 100%; }
.ip-btn-sm { padding: 6px 12px; font-size: 0.82rem; }

.ip-icon-btn {
  border: none;
  background: transparent;
  font-size: 1.3rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
}
.ip-icon-btn:hover { background: #f1f5f9; }

.ip-app-shell { display: flex; min-height: 100vh; }
.ip-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
}
.ip-sidebar-header h2 { font-size: 1.15rem; margin-bottom: 4px; }
.ip-sidebar-header { margin-bottom: 24px; }
.ip-nav-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.ip-nav-item {
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-weight: 500;
  color: var(--color-text);
}
.ip-nav-item:hover { background: #f1f5f9; }
.ip-nav-item-active { background: var(--color-primary); color: #fff; }
.ip-nav-item-active:hover { background: var(--color-primary-dark); }
.ip-sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ip-sidebar-backdrop { display: none; }

.ip-main-column { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ip-topbar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid var(--color-border);
}
.ip-main { padding: 28px; flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; }

.ip-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.ip-page-header h1 { font-size: 1.6rem; margin-bottom: 6px; }

.ip-grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.ip-stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-sm);
}
.ip-stat-value { font-size: 1.8rem; font-weight: 700; color: var(--color-primary-dark); }
.ip-stat-label { font-size: 0.85rem; color: var(--color-text-muted); }

.ip-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.ip-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}
.ip-card h3 { font-size: 1.05rem; margin-bottom: 14px; }
.ip-card-narrow { max-width: 520px; }

.ip-bar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}
.ip-bar-row:last-child { border-bottom: none; }

.ip-table-wrap { overflow-x: auto; }
.ip-table { width: 100%; border-collapse: collapse; }
.ip-table th {
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 8px 10px;
  border-bottom: 2px solid var(--color-border);
}
.ip-table td { padding: 10px; border-bottom: 1px solid var(--color-border); font-size: 0.92rem; }
.ip-table tbody tr:hover { background: #f8fafc; }
.ip-table-actions { display: flex; gap: 8px; white-space: nowrap; }

.ip-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}
.ip-badge-neutral { background: #f1f5f9; color: var(--color-text-muted); }
.ip-badge-success { background: #dcfce7; color: #166534; }
.ip-badge-warning { background: #fef3c7; color: #92400e; }
.ip-badge-danger { background: #fee2e2; color: #991b1b; }
.ip-badge-info { background: #e0e7ff; color: #3730a3; }

.ip-tabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); }
.ip-tab {
  background: transparent;
  border: none;
  padding: 10px 16px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
}
.ip-tab:hover { color: var(--color-text); }
.ip-tab-active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

.ip-question-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.ip-question-card-compact { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.ip-question-text { font-weight: 600; margin-bottom: 10px; }
.ip-reference-answer {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border-left: 3px solid var(--color-primary-light);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  color: var(--color-text-muted);
}
.ip-level-filter {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  background: #fff;
  color: var(--color-text);
  height: fit-content;
}

.ip-empty-state { text-align: center; padding: 32px 16px; }
.ip-empty-state h3 { margin-bottom: 6px; }

.ip-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 100;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-weight: 600;
  font-size: 0.9rem;
  color: #fff;
  background: var(--color-primary);
  max-width: 320px;
}
.ip-toast-success { background: var(--color-success); }
.ip-toast-warning { background: var(--color-warning); }
.ip-toast-danger { background: var(--color-danger); }
.ip-toast-info { background: var(--color-primary); }

@media (max-width: 880px) {
  .ip-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .ip-sidebar-open { transform: translateX(0); }
  .ip-sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 55;
  }
  .ip-sidebar-backdrop-open { display: block; }
  .ip-topbar { display: flex; }
  .ip-main { padding: 18px; }
  .ip-two-col { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .ip-page-header { flex-direction: column; }
  .ip-grid-stats { grid-template-columns: repeat(2, 1fr); }
  .ip-form-actions { flex-direction: column-reverse; }
  .ip-form-actions .ip-btn { width: 100%; }
}
`;
