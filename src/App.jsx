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
  /* ── Computer Vision ──────────────────────────────────────────────────── */
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
      /* ── CV additional fresher ── */
      {
        id: 'cv-fresher-4',
        level: 'fresher',
        text: 'What is a pixel, and how is a color image stored as a numerical array?',
        referenceAnswer:
          'A pixel is the smallest addressable element of a digital image. A color image is stored as a 3-D array of shape (height × width × 3) where the three channels hold Red, Green, and Blue intensity values (0–255 for 8-bit). Grayscale drops to a 2-D array with one value per pixel.',
      },
      {
        id: 'cv-fresher-5',
        level: 'fresher',
        text: 'What is the purpose of pooling layers in a CNN, and what do max-pooling and average-pooling do differently?',
        referenceAnswer:
          'Pooling layers down-sample the spatial dimensions, reducing computation and providing a degree of translation invariance. Max-pooling keeps the highest activation in each window, preserving the strongest detected feature. Average-pooling averages all values, giving a smoother representation.',
      },
      {
        id: 'cv-fresher-6',
        level: 'fresher',
        text: 'What does "overfitting" mean when training an image classifier, and name two techniques to prevent it?',
        referenceAnswer:
          'Overfitting is when the model memorises training images instead of learning generalisable patterns, causing high validation/test error. Common remedies include data augmentation (creating synthetic variations of training images) and dropout (randomly zeroing activations during training to prevent co-adaptation).',
      },
      {
        id: 'cv-fresher-7',
        level: 'fresher',
        text: 'What is image thresholding and what is a common use-case for it?',
        referenceAnswer:
          'Thresholding converts a grayscale image to binary by setting pixels above a chosen intensity to white and below to black. It is widely used for foreground/background separation, for example isolating printed text from a page or detecting bright objects in a dark scene.',
      },
      {
        id: 'cv-fresher-8',
        level: 'fresher',
        text: 'What is the role of the ReLU activation function in a convolutional neural network?',
        referenceAnswer:
          'ReLU (Rectified Linear Unit) outputs max(0, x), introducing non-linearity so the network can learn complex functions beyond simple linear mappings. It also avoids the vanishing-gradient problem common with sigmoid/tanh and is computationally cheap to compute.',
      },
      /* ── CV additional entry ── */
      {
        id: 'cv-entry-4',
        level: 'entry',
        text: 'What is batch normalisation and why is it used in deep CNNs?',
        referenceAnswer:
          'Batch normalisation normalises the activations of each layer across the mini-batch to have zero mean and unit variance, then applies learnable scale and shift. It accelerates training by allowing higher learning rates, reduces sensitivity to weight initialisation, and has a mild regularising effect.',
      },
      {
        id: 'cv-entry-5',
        level: 'entry',
        text: 'What is the difference between semantic segmentation and instance segmentation?',
        referenceAnswer:
          'Semantic segmentation assigns a class label to every pixel but does not differentiate between individual objects of the same class (all "car" pixels share one label). Instance segmentation goes further and gives each distinct object instance its own mask, so two cars each get separate labels.',
      },
      {
        id: 'cv-entry-6',
        level: 'entry',
        text: 'What is mean Average Precision (mAP), and why is it the standard metric for object detectors?',
        referenceAnswer:
          'mAP computes the Average Precision (area under the precision-recall curve) at one or more IoU thresholds, then averages across all object classes. It jointly evaluates localisation accuracy and classification quality, making it a more complete measure than per-class accuracy alone.',
      },
      {
        id: 'cv-entry-7',
        level: 'entry',
        text: 'Explain the role of skip (residual) connections in networks like ResNet.',
        referenceAnswer:
          'Skip connections add the input of a block directly to its output (identity shortcut). This gives the network a gradient highway during backpropagation, enabling stable training of very deep models (100+ layers) by preventing vanishing gradients, and making it easy for layers to learn an identity mapping when that is optimal.',
      },
      {
        id: 'cv-entry-8',
        level: 'entry',
        text: 'What preprocessing steps would you apply before training an object detector on a custom dataset?',
        referenceAnswer:
          'Resize images to a consistent resolution, normalise pixel values using the dataset mean and standard deviation, apply data augmentation (random flip, colour jitter, mosaic tiling), validate and clean annotations (fix incorrect/missing bounding boxes), and split data into train/val/test sets in a stratified manner by class.',
      },
      /* ── CV additional intermediate ── */
      {
        id: 'cv-intermediate-4',
        level: 'intermediate',
        text: 'How would you adapt a CV model trained on daytime images to work reliably at night?',
        referenceAnswer:
          'Domain adaptation techniques: fine-tune on a small labelled night-time dataset, use unsupervised domain adaptation (e.g., adversarial feature alignment), apply aggressive augmentation simulating low-light conditions, or use image-to-image translation (CycleGAN-style) to synthesise night images from day data for training.',
      },
      {
        id: 'cv-intermediate-5',
        level: 'intermediate',
        text: 'Describe the Vision Transformer (ViT) architecture and how it differs from a CNN.',
        referenceAnswer:
          'ViT splits the input image into fixed-size patches, flattens each into a vector, adds positional embeddings, and feeds the sequence through standard Transformer encoder blocks with multi-head self-attention. Unlike CNNs, it has no built-in inductive bias for local spatial structure, so it requires large amounts of pre-training data but scales better with compute.',
      },
      {
        id: 'cv-intermediate-6',
        level: 'intermediate',
        text: 'What is panoptic segmentation and how does it combine semantic and instance segmentation?',
        referenceAnswer:
          'Panoptic segmentation produces a single output where every pixel has both a class label and an instance ID. "Stuff" classes (sky, road) are handled like semantic segmentation; "thing" classes (people, cars) are handled with instance masks. Models like Panoptic FPN merge feature pyramids to predict both heads jointly.',
      },
      {
        id: 'cv-intermediate-7',
        level: 'intermediate',
        text: 'How would you build and evaluate a video action-recognition model? What unique challenges arise compared to image classification?',
        referenceAnswer:
          'Common approaches: 3D convolutions (C3D, SlowFast), two-stream networks (spatial + optical-flow), or video-adapted Transformers (TimeSFormer). Unique challenges include temporal modelling over variable-length clips, high memory/compute cost, the need for dense frame-level labels, and choosing the right clip sampling strategy for evaluation.',
      },
      {
        id: 'cv-intermediate-8',
        level: 'intermediate',
        text: 'What is depthwise separable convolution and why is it used in lightweight architectures like MobileNet?',
        referenceAnswer:
          'It factors a standard convolution into a depthwise convolution (one filter per channel) followed by a 1×1 pointwise convolution. This reduces multiply-add operations by roughly 8–9× compared to a standard 3×3 conv, enabling fast inference on mobile/edge devices with only a modest accuracy trade-off.',
      },
      /* ── CV additional advanced ── */
      {
        id: 'cv-advanced-4',
        level: 'advanced',
        text: 'How does Non-Maximum Suppression work, and when would you replace it with Soft-NMS or DETR-style detection?',
        referenceAnswer:
          'NMS greedily removes boxes with IoU above a threshold to the highest-scoring box. It fails when overlapping objects of the same class exist in a dense scene. Soft-NMS decays rather than removes neighbouring boxes, improving recall in crowds. DETR uses bipartite matching and removes the need for NMS entirely by design.',
      },
      {
        id: 'cv-advanced-5',
        level: 'advanced',
        text: 'How would you design a real-time multi-object tracking pipeline, and which algorithm would you choose?',
        referenceAnswer:
          'Combine a detector (e.g. YOLOv8) with a tracker. For real-time, SORT (Kalman filter + IoU matching) is fast but loses identity on occlusion; StrongSORT and ByteTrack improve re-ID robustness by using appearance features and tracking low-confidence detections. Key design decisions: detector frequency, Re-ID model, track lifecycle (birth/death).',
      },
      {
        id: 'cv-advanced-6',
        level: 'advanced',
        text: 'How would you train a CV model with limited labelled data? Describe at least two approaches.',
        referenceAnswer:
          'Transfer learning (fine-tune a pretrained backbone on a small labelled set), semi-supervised learning (use unlabelled data with pseudo-labels or consistency regularisation), self-supervised pre-training (SimCLR, DINO), and active learning (select the most informative images for human labelling) all reduce labelling requirements significantly.',
      },
      {
        id: 'cv-advanced-7',
        level: 'advanced',
        text: 'Walk through how you would detect data drift in a production computer vision system.',
        referenceAnswer:
          'Compare incoming image statistics (pixel distribution, brightness, blur) against training baselines using drift detectors (KL divergence, MMD). Monitor model confidence score distributions — a shift often signals covariate drift. For ground-truth drift, use production shadow labels or periodic human review, then trigger retraining when drift exceeds a threshold.',
      },
      {
        id: 'cv-advanced-8',
        level: 'advanced',
        text: 'What strategies would you use to quantise and deploy a CV model on an edge device with limited compute?',
        referenceAnswer:
          'Post-training quantisation (INT8/INT4) via TensorRT or ONNX Runtime, optionally with quantisation-aware training to recover accuracy. Prune unimportant weights before quantising. Choose a mobile-friendly backbone (EfficientNet-Lite, MobileNetV3). Compile to a device-specific runtime (TFLite, CoreML, OpenVINO). Profile to find the actual bottleneck (memory vs. compute vs. I/O).',
      },
      /* ── CV additional expert ── */
      {
        id: 'cv-expert-4',
        level: 'expert',
        text: 'How would you design a multi-modal system combining vision and language (e.g. visual question answering or image captioning)?',
        referenceAnswer:
          'A strong answer covers: a vision encoder (ViT or CNN backbone) producing patch embeddings, a text encoder or decoder (LLM), a cross-attention or projection layer to align vision and text feature spaces, pre-training on large image-text pairs (CLIP-style contrastive or BLIP-style generative), and downstream fine-tuning. Key challenges: alignment training data quality, handling grounding and hallucination.',
      },
      {
        id: 'cv-expert-5',
        level: 'expert',
        text: 'How would you architect an end-to-end CV platform that processes millions of images daily across multiple use-cases?',
        referenceAnswer:
          'A scalable design includes: an ingestion layer (Kafka/Kinesis), distributed inference workers (GPU autoscaling on Kubernetes), a model registry for versioned model artifacts, feature store for cached embeddings, a result store (object storage + metadata DB), monitoring for drift and latency, and an active-learning feedback loop. Separating preprocessing, inference, and postprocessing allows independent scaling.',
      },
      {
        id: 'cv-expert-6',
        level: 'expert',
        text: 'How would you approach privacy and fairness concerns when deploying a face recognition system at scale?',
        referenceAnswer:
          'Privacy: obtain explicit consent, minimise data retention (compute embeddings then discard raw images), apply differential privacy, and comply with GDPR/BIPA. Fairness: audit error rates disaggregated by demographic group (gender, skin tone, age), use balanced training data, publish a model card, and establish human review for high-stakes decisions.',
      },
      {
        id: 'cv-expert-7',
        level: 'expert',
        text: 'Describe how NeRF (Neural Radiance Fields) works and where it is practically applicable.',
        referenceAnswer:
          'NeRF trains an MLP to map a 3-D position and viewing direction to volume density and colour. By rendering rays through this implicit representation with volume rendering, it reconstructs photo-realistic novel views of a scene from a set of posed 2D images. Practical applications include 3D content creation, robotics scene understanding, and VR/AR asset generation.',
      },
      {
        id: 'cv-expert-8',
        level: 'expert',
        text: 'What is your view on the ROI and maturity of visual SLAM and how would you apply it in a robotics product?',
        referenceAnswer:
          'Visual SLAM (Simultaneous Localisation and Mapping) is mature for structured indoor environments (ORB-SLAM3, RTAB-Map) but degrades outdoors or in featureless scenes. Deep SLAM variants improve robustness but need GPU. For a product, I would start with a lidar-visual fusion for reliability, use a tight EKF for sensor fusion, and invest in loop-closure quality to bound drift over long trajectories.',
      },
    ],
  },
  /* ── Generative AI ─────────────────────────────────────────────────────── */
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
      /* ── GenAI additional fresher ── */
      {
        id: 'genai-fresher-4',
        level: 'fresher',
        text: 'What is tokenisation in an LLM, and why does the way text is split into tokens matter?',
        referenceAnswer:
          'Tokenisation splits text into sub-word units (e.g. using BPE or WordPiece) that form the model\'s vocabulary. The splitting affects context length (more tokens = longer sequence), handling of rare words, and multilingual performance. Numbers and code often tokenise inefficiently, which is why arithmetic and code can be harder for LLMs.',
      },
      {
        id: 'genai-fresher-5',
        level: 'fresher',
        text: 'What does the "context window" of an LLM mean, and what happens when you exceed it?',
        referenceAnswer:
          'The context window is the maximum number of tokens the model can attend to at once (input + output). Tokens outside the window are simply not seen by the model. Exceeding the context requires truncation, chunking, or retrieval strategies — you cannot just pass more tokens in.',
      },
      {
        id: 'genai-fresher-6',
        level: 'fresher',
        text: 'What is the difference between zero-shot and few-shot prompting?',
        referenceAnswer:
          'Zero-shot asks the model to perform a task with only an instruction and no examples. Few-shot includes a small number of input-output demonstration pairs in the prompt, helping the model pattern-match the desired format or reasoning style. Few-shot generally improves output quality on tasks where the model is uncertain about the expected format.',
      },
      {
        id: 'genai-fresher-7',
        level: 'fresher',
        text: 'What are word embeddings and how are they used in AI applications?',
        referenceAnswer:
          'Embeddings are dense numerical vectors that represent words (or sentences, documents, images) in a high-dimensional space where semantic similarity corresponds to geometric closeness. They are used for semantic search (find similar documents), retrieval-augmented generation, recommendation systems, and as inputs to downstream ML models.',
      },
      {
        id: 'genai-fresher-8',
        level: 'fresher',
        text: 'What is the system prompt in a chat-based LLM API, and what is it used for?',
        referenceAnswer:
          'The system prompt is a special instruction block prepended before the conversation that sets the model\'s persona, tone, rules, and task scope. It is not shown to the end user and is processed with higher priority by the model. It is used to enforce brand voice, restrict off-topic responses, and configure tool usage.',
      },
      /* ── GenAI additional entry ── */
      {
        id: 'genai-entry-4',
        level: 'entry',
        text: 'What is Reinforcement Learning from Human Feedback (RLHF) and why is it used to align LLMs?',
        referenceAnswer:
          'RLHF fine-tunes a pretrained LLM using human preference data: human raters rank model outputs, a reward model is trained on those rankings, and the LLM policy is updated via PPO (proximal policy optimisation) to maximise the reward signal. This aligns the model towards helpfulness, harmlessness, and honesty beyond what supervised fine-tuning alone achieves.',
      },
      {
        id: 'genai-entry-5',
        level: 'entry',
        text: 'What is chain-of-thought prompting and when does it help?',
        referenceAnswer:
          'Chain-of-thought prompting instructs the model to produce its reasoning steps before the final answer (e.g., "Let\'s think step by step"). It significantly improves performance on multi-step reasoning, arithmetic, and logical problems because the intermediate tokens give the model more "scratchpad" space to work through the problem.',
      },
      {
        id: 'genai-entry-6',
        level: 'entry',
        text: 'What is a vector database and why is it used with LLMs?',
        referenceAnswer:
          'A vector database stores high-dimensional embeddings and supports fast approximate nearest-neighbour (ANN) search (e.g., Pinecone, Weaviate, pgvector). In LLM applications it enables retrieval-augmented generation: relevant document chunks are retrieved by embedding similarity and injected into the prompt, grounding the model\'s output in actual source material.',
      },
      {
        id: 'genai-entry-7',
        level: 'entry',
        text: 'Describe the difference between open-source LLMs (Llama, Mistral) and closed-source APIs (GPT-4, Claude), and when you would choose each.',
        referenceAnswer:
          'Closed APIs offer state-of-the-art quality with no infrastructure overhead but incur per-token cost, vendor lock-in, and data-privacy concerns. Open-source models can be self-hosted (on-prem or private cloud) for full data control, lower marginal cost at scale, and offline operation, but require ML infrastructure expertise and may lag in quality for complex tasks.',
      },
      {
        id: 'genai-entry-8',
        level: 'entry',
        text: 'What is instruction fine-tuning and how does it differ from base model pretraining?',
        referenceAnswer:
          'Pretraining trains on massive unlabelled text to predict the next token, building broad world knowledge. Instruction fine-tuning then trains the model on curated (instruction, response) pairs so it learns to follow directions, answer questions, and refuse harmful requests, shaping the model\'s behaviour without relearning facts from scratch.',
      },
      /* ── GenAI additional intermediate ── */
      {
        id: 'genai-intermediate-4',
        level: 'intermediate',
        text: 'What is LoRA (Low-Rank Adaptation) and why is it a popular approach for fine-tuning LLMs?',
        referenceAnswer:
          'LoRA freezes the original model weights and injects trainable low-rank decomposition matrices (A and B) into the attention layers. Only these small matrices are updated, reducing trainable parameters by 10-100× versus full fine-tuning. This makes fine-tuning feasible on a single GPU and allows multiple task-specific adapters to be swapped without duplicating the base model.',
      },
      {
        id: 'genai-intermediate-5',
        level: 'intermediate',
        text: 'How would you implement a multi-turn conversational agent that maintains coherent context?',
        referenceAnswer:
          'Maintain a message history list and pass it on every API call. For long conversations, apply a sliding window (drop oldest turns), summarise history with an LLM, or use a memory store. Structured system prompts define persona and policy. Tool/function calling handles actions (search, DB queries) within the turn loop.',
      },
      {
        id: 'genai-intermediate-6',
        level: 'intermediate',
        text: 'What are the main failure modes of a RAG pipeline and how would you debug them?',
        referenceAnswer:
          'Common failures: (1) retrieval misses relevant chunks — debug with retrieval recall tests; fix by improving chunking or switching to hybrid search. (2) retrieved chunks are not synthesised well — debug with LLM faithfulness metrics; fix with re-ranking or prompt engineering. (3) stale index — add re-indexing pipelines. (4) hallucination despite retrieval — enforce citation constraints in the prompt.',
      },
      {
        id: 'genai-intermediate-7',
        level: 'intermediate',
        text: 'How do you measure and optimise the latency and throughput of an LLM API endpoint?',
        referenceAnswer:
          'Key metrics: time-to-first-token (TTFT) and tokens-per-second (TPS). Optimisations: use streaming to reduce perceived TTFT, batch requests where latency allows, cache repeated prompts, apply quantisation (INT8/INT4), choose the smallest model that meets quality bar, and use KV-cache-aware scheduling. Profile with load tests to find the actual bottleneck.',
      },
      {
        id: 'genai-intermediate-8',
        level: 'intermediate',
        text: 'What are the trade-offs between using an agent (function-calling) approach versus a single large prompt for a complex task?',
        referenceAnswer:
          'A single prompt is simpler, cheaper, and lower-latency but is limited by context length and struggles with tasks requiring external data or multi-step tool use. An agent framework decomposes tasks, calls tools (APIs, databases, search), and iterates — more powerful for complex workflows, but adds orchestration complexity, higher latency, and harder debugging of emergent failures.',
      },
      /* ── GenAI additional advanced ── */
      {
        id: 'genai-advanced-4',
        level: 'advanced',
        text: 'How would you design an LLM application for processing confidential enterprise documents while keeping all data on-premise?',
        referenceAnswer:
          'Self-host an open-source model (Llama, Mistral) in a private VPC with no egress to the internet. Use a local vector store (pgvector, Qdrant) for retrieval. Implement role-based access control so only authorised users retrieve specific document chunks. Audit every query/response for compliance. Consider a private inference endpoint like vLLM or Ollama for serving.',
      },
      {
        id: 'genai-advanced-5',
        level: 'advanced',
        text: 'How would you handle prompt injection attacks in an LLM-based application?',
        referenceAnswer:
          'Prompt injection is when user-supplied text manipulates the model to override system instructions. Mitigations: use a separate system prompt that is never mixed with user input, sanitise user input, apply output validation to catch unexpected instruction-following, limit model tool permissions (principle of least privilege), and use a safety classifier to detect adversarial patterns before passing to the main model.',
      },
      {
        id: 'genai-advanced-6',
        level: 'advanced',
        text: 'What are the risks of LLMs in high-stakes domains (medical, legal, finance) and how would you mitigate them?',
        referenceAnswer:
          'Risks: hallucination of facts, outdated knowledge, bias in outputs, privacy leakage from training data. Mitigations: always ground answers in retrieved authoritative sources (RAG), display citations, implement human-in-the-loop review for consequential outputs, add output confidence indicators, run adversarial red-teaming, and limit the model to retrieval/summarisation rather than autonomous decision-making.',
      },
      {
        id: 'genai-advanced-7',
        level: 'advanced',
        text: 'Explain speculative decoding and how it improves LLM inference throughput without changing output quality.',
        referenceAnswer:
          'A small "draft" model generates several candidate tokens in parallel, then the large "verifier" model checks all of them in a single forward pass. Accepted tokens are kept (matching what the verifier would have produced); rejected tokens are discarded. Because the verifier processes multiple tokens simultaneously, overall throughput increases substantially while output distribution stays identical to pure verifier sampling.',
      },
      {
        id: 'genai-advanced-8',
        level: 'advanced',
        text: 'How would you set up a rigorous LLM evaluation framework for a production customer-support chatbot?',
        referenceAnswer:
          'Combine: (1) automated metrics — LLM-as-judge rubric for correctness, helpfulness, and citation fidelity on a gold-standard eval set; (2) human evaluation on a sampled production traffic slice; (3) task-specific metrics (CSAT, resolution rate); (4) red-team adversarial tests; (5) regression tests that flag quality regressions after each model or prompt update.',
      },
      /* ── GenAI additional expert ── */
      {
        id: 'genai-expert-4',
        level: 'expert',
        text: 'How would you design the serving infrastructure for an LLM system handling millions of requests per day at low latency?',
        referenceAnswer:
          'Key components: vLLM or TRT-LLM for continuous batching and PagedAttention; autoscaling GPU pods on Kubernetes based on queue depth; a load balancer routing by prompt length for efficient batching; prompt caching for repeated prefixes; a model tier (cheap/fast vs. powerful/slow) with a router; observability (TTFT, TPS, error rates, GPU utilisation). Use spot/preemptible instances for batch traffic.',
      },
      {
        id: 'genai-expert-5',
        level: 'expert',
        text: 'Describe a strategy for continual learning of an LLM in production without catastrophic forgetting.',
        referenceAnswer:
          'Catastrophic forgetting occurs when fine-tuning on new data overwrites prior knowledge. Strategies: Elastic Weight Consolidation (penalise changes to weights important for old tasks), progressive neural networks, replay buffers (mix new data with a sample of old), or use LoRA adapters that are task-specific and composable so the base model is never modified.',
      },
      {
        id: 'genai-expert-6',
        level: 'expert',
        text: 'How would you architect a hybrid system combining LLMs with structured knowledge (knowledge graphs, relational databases) to eliminate hallucination on factual queries?',
        referenceAnswer:
          'Use the LLM to parse intent and generate a structured query (SPARQL, SQL, Cypher); execute the query against a ground-truth knowledge source; inject the structured result into the prompt for the LLM to synthesise into natural language. Separate retrieval (factual) from generation (linguistic) eliminates hallucination for structured facts while preserving fluency. Add a confidence gate that routes to the knowledge source when the LLM output does not match.',
      },
      {
        id: 'genai-expert-7',
        level: 'expert',
        text: 'Discuss compute, data, and architecture choices that go into training a frontier-scale LLM from scratch.',
        referenceAnswer:
          'Compute: thousands of GPUs/TPUs with high-bandwidth interconnect (NVLink, InfiniBand), mixed-precision (BF16) training, gradient checkpointing, ZeRO optimisation for memory efficiency. Data: trillion-token, diverse, deduplicated corpus with careful quality filtering, tokeniser optimised for the data distribution. Architecture: decoder-only transformer with grouped-query attention, RoPE positional encodings, SwiGLU activations. Training: constant then cosine LR schedule, careful loss monitoring for spikes, model-parallel + data-parallel + pipeline-parallel strategies.',
      },
      {
        id: 'genai-expert-8',
        level: 'expert',
        text: 'What is your view on the ROI of multi-agent LLM systems versus a single well-prompted frontier model, and when would you choose each?',
        referenceAnswer:
          'Multi-agent is worthwhile when tasks are decomposable and parallelisable (research + draft + review), require specialised sub-agents (code executor, web search), or exceed a single context window. A single model is simpler, cheaper, and easier to debug. The hidden cost of multi-agent is orchestration complexity, latency amplification, and error propagation between agents. Start with a single model and move to multi-agent only when a specific bottleneck justifies it.',
      },
    ],
  },
  /* ── Behavioral & SDLC ─────────────────────────────────────────────────── */
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
      /* ── Behavioral additional fresher ── */
      {
        id: 'beh-fresher-4',
        level: 'fresher',
        text: 'How do you approach learning a new programming language, library, or tool you have never used before?',
        referenceAnswer:
          'Look for a structured self-learning approach: official docs/tutorials first, build a small project to apply it, read source code or examples, and ask peers or communities (Stack Overflow, Discord). A candidate who names specific learning resources shows initiative, while one who waits to be taught raises a flag.',
      },
      {
        id: 'beh-fresher-5',
        level: 'fresher',
        text: 'Tell me about a time you received critical feedback. How did you respond to it?',
        referenceAnswer:
          'Look for: emotional maturity (no defensiveness), genuine curiosity about the feedback, a concrete action taken to address it, and evidence it actually changed something. A red flag is someone who reframes every piece of criticism as misunderstanding.',
      },
      {
        id: 'beh-fresher-6',
        level: 'fresher',
        text: 'What does "clean code" mean to you and how do you try to achieve it in practice?',
        referenceAnswer:
          'Look for: meaningful variable/function names, small focused functions, avoiding magic numbers, writing comments for the "why" not the "what", and consistent formatting. Bonus if they mention code review as a feedback mechanism. A vague answer ("readable code") with no concrete examples is weaker.',
      },
      {
        id: 'beh-fresher-7',
        level: 'fresher',
        text: 'Describe a time you had to collaborate closely with others on a technical project. What was your role and what made it successful or difficult?',
        referenceAnswer:
          'Look for: clear articulation of their specific contribution (not "we did everything together"), how they handled disagreements, whether they communicated blockers proactively, and what they learned about collaboration. Real stories with specific friction points are more credible than idealised "we all got along great" narratives.',
      },
      {
        id: 'beh-fresher-8',
        level: 'fresher',
        text: 'How do you test your code before submitting it? Walk me through your typical process.',
        referenceAnswer:
          'Look for a methodical process beyond "I just run it and see if it works": unit tests, edge-case thinking, manual walk-through of inputs, checking error paths, and whether they diff their own changes before submitting. Even a fresher who writes manual test cases shows good engineering instincts.',
      },
      /* ── Behavioral additional entry ── */
      {
        id: 'beh-entry-4',
        level: 'entry',
        text: 'Describe a feature you built that users actually interacted with. How did you know whether it was successful?',
        referenceAnswer:
          'Look for product thinking alongside engineering: connecting their work to user or business outcomes (metrics, user feedback, support tickets), and understanding the feedback loop between shipping and learning. "I built the API but never saw user data" is a missed opportunity; "I watched session recordings and found an edge case" shows ownership.',
      },
      {
        id: 'beh-entry-5',
        level: 'entry',
        text: 'How do you approach estimating time for a new task, and how accurate are you typically?',
        referenceAnswer:
          'Look for a real technique (break into sub-tasks, add a buffer, reference similar past work), honest self-assessment of estimation track record, and evidence of improvement over time. Claiming to always be accurate is a flag; someone who acknowledges under-estimation and explains what they changed is more credible.',
      },
      {
        id: 'beh-entry-6',
        level: 'entry',
        text: 'How do you handle ambiguous requirements when starting a new task?',
        referenceAnswer:
          'Look for: proactively clarifying with the requester (listing specific questions, not just "I ask"), identifying the minimum viable interpretation to unblock yourself, documenting assumptions, and surfacing ambiguity early rather than guessing and reworking later.',
      },
      {
        id: 'beh-entry-7',
        level: 'entry',
        text: 'Tell me about a mistake you made in a previous role or project and what you learned from it.',
        referenceAnswer:
          'Look for: candour about the actual mistake (not a humblebrag), genuine analysis of root cause rather than blaming circumstances, and a concrete change in behaviour afterwards. The best answers describe both the personal and team/process learning. Evasiveness or inability to name a real mistake is a red flag.',
      },
      {
        id: 'beh-entry-8',
        level: 'entry',
        text: 'How do you stay current with best practices and new developments in your technical field?',
        referenceAnswer:
          'Look for specific sources (papers, newsletters, YouTube channels, conference talks, open-source projects) rather than vague "I read articles". Evidence of applying something recently is stronger than passive consumption. Someone who participates in communities (OSS contributions, blog posts, local meetups) shows initiative.',
      },
      /* ── Behavioral additional intermediate ── */
      {
        id: 'beh-intermediate-4',
        level: 'intermediate',
        text: 'Describe a time you improved the performance of a system — reduced latency, memory usage, or cost. What was your approach?',
        referenceAnswer:
          'Look for: profiling before optimising (not gut-feel), a clear hypothesis, a controlled experiment, a measured result with before/after numbers, and awareness of trade-offs introduced (e.g. complexity vs. speed). "I just rewrote it in Rust and it was 3x faster" without profiling data is weaker than a methodical approach.',
      },
      {
        id: 'beh-intermediate-5',
        level: 'intermediate',
        text: 'Describe a build-vs-buy decision you had to make. What was your framework?',
        referenceAnswer:
          'Look for: assessing total cost of ownership (not just upfront cost), differentiation value (is this a core competency?), time-to-market, maintenance burden, and vendor lock-in risk. The best answers describe a specific decision with concrete numbers or constraints, not generic frameworks.',
      },
      {
        id: 'beh-intermediate-6',
        level: 'intermediate',
        text: 'Describe a time you introduced a new tool or process to your team. How did you handle adoption?',
        referenceAnswer:
          'Look for: starting with a proof of concept and letting results speak, addressing teammates\' concerns rather than dismissing them, documenting clearly, and measuring whether adoption actually improved outcomes. Mandating change without buy-in is a red flag; building consensus through demonstration is stronger.',
      },
      {
        id: 'beh-intermediate-7',
        level: 'intermediate',
        text: 'How do you handle a situation where a team member\'s work is blocking yours?',
        referenceAnswer:
          'Look for: early and specific communication of the blocker (not passive waiting), offering to pair or help unblock the other person, escalating appropriately when the timeline is at risk, and a lack of blame. The ability to reorder work and stay productive while blocked shows maturity.',
      },
      {
        id: 'beh-intermediate-8',
        level: 'intermediate',
        text: 'How do you approach writing tests for a feature you are building?',
        referenceAnswer:
          'Look for a sensible testing pyramid — more unit tests, fewer integration, fewest end-to-end — reasoning about what is worth testing (business logic, edge cases) versus what is not (trivial pass-through). Awareness of the maintenance cost of tests and knowing when to delete tests is a signal of maturity.',
      },
      /* ── Behavioral additional advanced ── */
      {
        id: 'beh-advanced-4',
        level: 'advanced',
        text: 'Describe how you have led the technical onboarding of a new team member or the handoff of a complex system.',
        referenceAnswer:
          'Look for: structured approach (docs, architecture overview, guided "first bug" task), setting explicit ramp expectations, iterating based on feedback from the onboardee, and investment in the other person\'s growth rather than just getting them productive fast. Ongoing pair programming is stronger than a single knowledge dump.',
      },
      {
        id: 'beh-advanced-5',
        level: 'advanced',
        text: 'Tell me about a time you had to lead a technical migration (language, framework, or infrastructure). What were the key risks and how did you manage them?',
        referenceAnswer:
          'Look for: a strangler-fig or parallel-run strategy rather than a big-bang rewrite, risk identification upfront (data migration, compatibility, rollback), a phased rollout with success metrics, stakeholder alignment on timeline, and an honest post-mortem on what went differently than expected.',
      },
      {
        id: 'beh-advanced-6',
        level: 'advanced',
        text: 'How have you built security into your team\'s development process rather than treating it as an afterthought?',
        referenceAnswer:
          'Look for: threat modelling during design, automated SAST/DAST in CI, secrets management (no hardcoded credentials), dependency vulnerability scanning, code review security checklist, and regular security training. The key signal is "left-shift" security thinking rather than a pentest at the end of a project.',
      },
      {
        id: 'beh-advanced-7',
        level: 'advanced',
        text: 'Describe an engineering productivity improvement you drove. What changed and how did you measure it?',
        referenceAnswer:
          'Look for: identifying the actual bottleneck (not just "standup was too long"), implementing a targeted change, and measuring the outcome with real metrics (deploy frequency, cycle time, test run time, flake rate). Shipping a new CI system that reduced build time by 50% with before/after data is much stronger than "morale improved".',
      },
      {
        id: 'beh-advanced-8',
        level: 'advanced',
        text: 'How do you handle a situation where two senior engineers on your team have a strong, unresolved disagreement on technical direction?',
        referenceAnswer:
          'Look for: facilitating a structured technical decision (RFC, spike/prototype to gather data, time-boxed discussion), separating the technical question from interpersonal tension, driving toward a decision rather than leaving it open, and documenting the reasoning so it does not re-emerge. Escalating to management too quickly is a flag.',
      },
      /* ── Behavioral additional expert ── */
      {
        id: 'beh-expert-4',
        level: 'expert',
        text: 'How do you build and sustain a high-performing engineering team over time?',
        referenceAnswer:
          'Look for: hiring for complementary skills and growth mindset, clear engineering standards and culture of feedback, regular 1:1s focused on growth not just status, psychological safety for raising issues early, career laddering, and specific examples of how they recovered a team going through a rough patch. Vague management-speak without concrete examples is a flag.',
      },
      {
        id: 'beh-expert-5',
        level: 'expert',
        text: 'Describe a situation where you balanced innovation with system stability in a product or platform.',
        referenceAnswer:
          'Look for: a portfolio approach (some stable foundational investments, some experimental bets), feature flagging and gradual rollouts, an explicit risk appetite decision made with business context, and evidence of learning from experiments that failed safely. "We never break prod" is a flag if it means no experiments.',
      },
      {
        id: 'beh-expert-6',
        level: 'expert',
        text: 'How do you make the case for platform or infrastructure investments that have no immediate user-visible value?',
        referenceAnswer:
          'Look for: translating technical risk into business cost (incidents prevented, developer velocity gained, compliance risk avoided), using analogies and data, building allies across product and finance, and proposing an incremental investment with measurable milestones. The ability to say "this pays for itself in N months because..." is the key skill.',
      },
      {
        id: 'beh-expert-7',
        level: 'expert',
        text: 'Tell me about a time you navigated significant organisational change — a reorg, leadership shift, or acquisition — while keeping your team focused.',
        referenceAnswer:
          'Look for: transparent communication with the team (acknowledging uncertainty rather than false reassurance), protecting the team from noise by acting as a buffer, helping individuals understand the impact on their roles, and maintaining delivery momentum by breaking work into achievable short cycles during the uncertainty period.',
      },
      {
        id: 'beh-expert-8',
        level: 'expert',
        text: 'How do you think about the ethical responsibilities of engineers and data scientists building AI/ML systems at scale?',
        referenceAnswer:
          'Look for: concrete examples beyond "we should be responsible" — fairness audits, bias testing, model cards, explainability for consequential decisions, data consent, environmental cost of large-model training. The strongest candidates have faced a real ethical tension and describe how they navigated it, not just abstract principles.',
      },
    ],
  },
  /* ── Machine Learning & Data Science ──────────────────────────────────── */
  {
    id: 'ml-data-science',
    name: 'Machine Learning & Data Science',
    questions: [
      { id: 'ml-fresher-1', level: 'fresher', text: 'What is the difference between supervised, unsupervised, and reinforcement learning? Give one example of each.', referenceAnswer: 'Supervised learning trains on labelled (input, output) pairs — e.g. image classification. Unsupervised discovers patterns without labels — e.g. k-means clustering of customer segments. Reinforcement learning trains an agent via reward signals from environment interactions — e.g. game-playing AI.' },
      { id: 'ml-fresher-2', level: 'fresher', text: 'Why do we split a dataset into training, validation, and test sets?', referenceAnswer: 'Training data teaches the model parameters; the validation set tunes hyperparameters and guides early stopping without contaminating final evaluation; the test set provides an unbiased estimate of generalisation performance used only once at the end. Using test data during development leads to overly optimistic error estimates.' },
      { id: 'ml-fresher-3', level: 'fresher', text: 'What is overfitting and what are two ways to prevent it?', referenceAnswer: 'Overfitting occurs when a model performs well on training data but poorly on unseen data because it has memorised noise. Prevention: (1) regularisation (L1/L2 adds a penalty on large weights), (2) data augmentation or collecting more training data, (3) reducing model complexity, or (4) dropout.' },
      { id: 'ml-fresher-4', level: 'fresher', text: 'What is the bias-variance tradeoff?', referenceAnswer: 'Bias is error from wrong assumptions in the model — underfitting. Variance is sensitivity to noise in training data — overfitting. Increasing model complexity reduces bias but increases variance. The goal is to find the sweet spot that minimises total test error (bias² + variance + irreducible noise).' },
      { id: 'ml-fresher-5', level: 'fresher', text: 'Explain precision and recall. When would you prioritise one over the other?', referenceAnswer: 'Precision = TP / (TP + FP) — of all predicted positives, how many are correct. Recall = TP / (TP + FN) — of all actual positives, how many did we catch. Prioritise precision when false positives are costly (spam filter mislabelling real emails); prioritise recall when false negatives are costly (cancer screening).' },
      { id: 'ml-fresher-6', level: 'fresher', text: 'What is a decision tree and how does it make predictions?', referenceAnswer: 'A decision tree recursively partitions the feature space by selecting the feature and split threshold that maximises information gain (or minimises Gini impurity) at each node. Predictions are made by traversing from the root, following the branch whose condition matches the input, until a leaf node gives the class or value.' },
      { id: 'ml-fresher-7', level: 'fresher', text: 'What is cross-validation and why is it used?', referenceAnswer: 'Cross-validation (typically k-fold) splits data into k folds, trains on k−1 folds and validates on the remaining fold k times, then averages results. It gives a more reliable performance estimate than a single train/val split, especially with small datasets, and helps detect high variance in model performance.' },
      { id: 'ml-fresher-8', level: 'fresher', text: 'What is feature scaling (normalisation/standardisation) and when do you need it?', referenceAnswer: 'Feature scaling transforms numeric features to a common range. Standardisation (zero mean, unit variance) or min-max normalisation is needed for algorithms sensitive to feature magnitudes: linear/logistic regression with regularisation, SVMs, k-NN, k-means, and neural networks. Tree-based models (Random Forest, XGBoost) are invariant to monotonic scaling and do not require it.' },
      { id: 'ml-entry-1', level: 'entry', text: 'Explain gradient descent. How does learning rate affect training?', referenceAnswer: 'Gradient descent iteratively updates model parameters by subtracting a fraction (learning rate) of the loss gradient with respect to parameters. Too high a learning rate causes divergence or oscillation; too low causes very slow convergence. Adaptive optimisers (Adam, RMSProp) adjust per-parameter learning rates automatically.' },
      { id: 'ml-entry-2', level: 'entry', text: 'What is the difference between L1 and L2 regularisation, and what does each do to model weights?', referenceAnswer: 'L1 (Lasso) adds the sum of absolute weight values to the loss, promoting sparsity — it drives many weights exactly to zero, performing implicit feature selection. L2 (Ridge) adds the sum of squared weights, penalising large weights uniformly and producing small but non-zero weights, reducing variance without sparsity.' },
      { id: 'ml-entry-3', level: 'entry', text: 'What is a confusion matrix and how do you compute common metrics from it?', referenceAnswer: 'A confusion matrix is a 2×2 table (for binary classification) with TP, FP, FN, TN counts. From it: Accuracy = (TP+TN)/N, Precision = TP/(TP+FP), Recall = TP/(TP+FN), F1 = 2×Precision×Recall/(Precision+Recall). For multi-class, it is an n×n matrix where diagonal elements are correct predictions.' },
      { id: 'ml-entry-4', level: 'entry', text: 'What are ensemble methods? Explain bagging and boosting with an example of each.', referenceAnswer: 'Ensembles combine multiple weak learners to reduce error. Bagging trains models on bootstrap samples in parallel and averages predictions — Random Forest is the canonical example. Boosting trains models sequentially, each correcting the errors of the previous — XGBoost/AdaBoost are examples. Bagging reduces variance; boosting reduces bias.' },
      { id: 'ml-entry-5', level: 'entry', text: 'What is the curse of dimensionality and why does it matter for ML?', referenceAnswer: 'As feature dimensions grow, the volume of the space increases exponentially, making data increasingly sparse. Distance-based algorithms (k-NN, k-means, SVMs with RBF kernel) degrade because all points become equidistant. Feature selection, PCA, or manifold learning reduces effective dimensionality.' },
      { id: 'ml-entry-6', level: 'entry', text: 'How would you handle missing values in a dataset?', referenceAnswer: 'Options: (1) drop rows/columns if missingness is low and random; (2) impute with mean/median/mode; (3) model-based imputation (regression, k-NN, or iterative imputer); (4) create a binary "was_missing" indicator feature; (5) use tree-based models that natively handle missing values (XGBoost\'s missing branch). The right choice depends on the missingness mechanism (MCAR, MAR, MNAR) and volume.' },
      { id: 'ml-entry-7', level: 'entry', text: 'What is PCA (Principal Component Analysis) and when would you use it?', referenceAnswer: 'PCA finds the orthogonal directions of maximum variance in the data (principal components) and projects data onto the top-k components, reducing dimensionality while preserving as much variance as possible. Use it to visualise high-dimensional data, remove correlated features, or reduce input size for downstream models that struggle with many features.' },
      { id: 'ml-entry-8', level: 'entry', text: 'Explain the difference between generative and discriminative models.', referenceAnswer: 'Discriminative models (logistic regression, SVM, most neural nets) learn the decision boundary P(y|x) directly. Generative models (Naive Bayes, GMMs, VAEs, GANs) learn the joint distribution P(x,y) or P(x), enabling them to generate new samples but typically requiring more data and stronger assumptions.' },
      { id: 'ml-intermediate-1', level: 'intermediate', text: 'Compare XGBoost and a Random Forest. When would you choose one over the other?', referenceAnswer: 'XGBoost is a gradient boosting method that builds trees sequentially to correct residuals and often achieves higher accuracy on tabular data; it is sensitive to hyperparameters and slower to train. Random Forest trains trees in parallel on bootstrap samples and is more robust out-of-the-box and faster for large datasets. Choose RF as a reliable baseline; switch to XGBoost when squeezing out maximum accuracy matters and you have time to tune.' },
      { id: 'ml-intermediate-2', level: 'intermediate', text: 'How would you approach building a recommendation system? Describe collaborative filtering vs. content-based filtering.', referenceAnswer: 'Collaborative filtering (matrix factorisation, ALS) leverages user-item interaction history to find similar users/items — it suffers from cold-start. Content-based uses item features to recommend similar items the user liked — works for new items but limited to the feature space. Hybrid systems combine both. For scale, use approximate nearest-neighbour indexes (FAISS, ScaNN) on learned embeddings.' },
      { id: 'ml-intermediate-3', level: 'intermediate', text: 'How do you detect and handle data leakage in a machine learning project?', referenceAnswer: 'Data leakage occurs when information from the future or target variable contaminates features used for training, making validation metrics misleadingly optimistic. Detection: sudden suspiciously high performance, or features that are logically post-outcome. Prevention: always split data first before any preprocessing, use time-based splits for temporal data, and scrutinise every feature\'s causal relationship to the target.' },
      { id: 'ml-intermediate-4', level: 'intermediate', text: 'What is time-series cross-validation and why does standard k-fold fail for time-series data?', referenceAnswer: 'Standard k-fold shuffles data, allowing the model to train on future data and validate on the past — a form of data leakage. Time-series cross-validation uses expanding windows or sliding windows that always train on past data and validate on strictly future data, preserving temporal order and giving a realistic performance estimate.' },
      { id: 'ml-intermediate-5', level: 'intermediate', text: 'Describe the steps for building an end-to-end ML pipeline for a new business problem.', referenceAnswer: 'Frame the problem (target, success metric, baseline). Collect and explore data (EDA, quality audit). Feature engineering. Establish baseline (simple model: linear, tree). Iterative modelling (experiment tracking, hyperparameter tuning). Evaluate on held-out test set. Deploy (inference pipeline, monitoring). Iterate based on production feedback.' },
      { id: 'ml-intermediate-6', level: 'intermediate', text: 'How would you approach a severe class imbalance problem (e.g., 1 positive per 10,000 negatives)?', referenceAnswer: 'Use appropriate metrics (PR-AUC, F1, MCC — not accuracy). Techniques: class-weighted loss, oversampling minorities (SMOTE), undersampling majorities, threshold tuning on the validation set, or anomaly detection reformulation for extreme imbalance. Always stratify splits to maintain the imbalance ratio in each fold.' },
      { id: 'ml-intermediate-7', level: 'intermediate', text: 'Explain how gradient boosting works under the hood.', referenceAnswer: 'Gradient boosting fits an additive model in a stage-wise manner. At each stage, a weak learner (shallow decision tree) is fit to the negative gradient (pseudo-residuals) of the loss with respect to the current ensemble prediction. The new tree is added to the ensemble with a shrinkage (learning rate) scaling factor. XGBoost further adds regularisation on leaf weights and second-order gradient information.' },
      { id: 'ml-intermediate-8', level: 'intermediate', text: 'How would you design an A/B test to evaluate whether a new ML model outperforms the existing one in production?', referenceAnswer: 'Randomly assign users to control (old model) and treatment (new model) groups, ensuring assignment is stable (same user always gets the same variant). Define primary metric and sample size using power analysis before starting. Run for a full business cycle. Test for statistical significance with appropriate corrections for multiple comparisons. Watch for novelty effects and segment performance by user cohort.' },
      { id: 'ml-advanced-1', level: 'advanced', text: 'Describe how you would build and interpret an interpretable ML model for a regulated industry (e.g., credit scoring).', referenceAnswer: 'Prefer inherently interpretable models (logistic regression, scorecard) or post-hoc explanation for tree models (SHAP). Logistic regression with well-engineered features gives additive score contributions legible to regulators. SHAP global summaries show feature importance, and local SHAP explains individual decisions — important for adverse action notices. Validate explanations are stable and consistent.' },
      { id: 'ml-advanced-2', level: 'advanced', text: 'How would you approach a regression problem on tabular data with very high-cardinality categorical features (e.g., zip codes with 100k+ unique values)?', referenceAnswer: 'Options: target encoding (encode with mean target per category, with regularisation/smoothing to avoid leakage), entity embeddings (learned dense representations via a neural network), feature hashing, or grouped aggregation. Tree-based models with built-in cardinality handling (CatBoost) are often simplest. Always validate encoding on a held-out fold to prevent leakage.' },
      { id: 'ml-advanced-3', level: 'advanced', text: 'Explain Bayesian optimisation and when you would use it for hyperparameter tuning instead of grid or random search.', referenceAnswer: 'Bayesian optimisation builds a surrogate probabilistic model (Gaussian Process or Tree Parzen Estimator) of the objective function and uses an acquisition function (Expected Improvement) to select the next hyperparameter configuration most likely to improve results. It is more sample-efficient than random search — useful when each evaluation is expensive (hours of training), but adds overhead that is not worth it for cheap evaluations.' },
      { id: 'ml-advanced-4', level: 'advanced', text: 'What is causal inference and how does it differ from predictive modelling? Give a practical example.', referenceAnswer: 'Predictive models find correlations to minimise prediction error; causal models estimate the effect of an intervention (treatment) on an outcome. Example: a correlation between ice cream sales and drowning does not imply causation (confounded by temperature). Causal methods — propensity score matching, instrumental variables, difference-in-differences — control for confounders so an intervention effect can be reliably estimated, critical for policy decisions and feature impact analysis.' },
      { id: 'ml-advanced-5', level: 'advanced', text: 'Describe a production ML project you led from data collection to deployment. What were the key challenges?', referenceAnswer: 'Look for: problem framing decisions, data pipeline ownership, feature engineering choices, model selection rationale, evaluation rigour (held-out test, slice analysis), deployment strategy (shadow mode, canary), monitoring setup, and a honest post-mortem. Key signals: quantified impact, handling of unexpected issues (data quality, distribution shift), and iteration after deployment.' },
      { id: 'ml-advanced-6', level: 'advanced', text: 'How do you ensure your ML model remains fair and unbiased over time in production?', referenceAnswer: 'Initial bias audit: compute performance metrics disaggregated by sensitive attributes (gender, race, age) and enforce fairness thresholds. Ongoing: monitor disaggregated metrics in production, set up drift alerts for feature and label distributions, re-evaluate fairness after each retraining. Apply debiasing techniques (reweighting, adversarial debiasing) when disparities are found, and document all decisions in a model card.' },
      { id: 'ml-advanced-7', level: 'advanced', text: 'What is multi-task learning and when does it benefit production ML systems?', referenceAnswer: 'Multi-task learning trains a shared representation across related tasks simultaneously. Benefits: tasks share information (auxiliary tasks act as regularisation), fewer parameters than separate models, better generalisation on low-data tasks. Most beneficial when tasks are positively correlated (e.g. click and purchase prediction in recommendation). Risks: task interference when tasks conflict; needs careful loss weighting.' },
      { id: 'ml-advanced-8', level: 'advanced', text: 'How would you approach transfer learning for a structured/tabular ML problem (not computer vision or NLP)?', referenceAnswer: 'Options: pre-train a neural network on a large related dataset (entity embeddings from a big e-commerce catalogue, then fine-tune on a smaller related task); use pre-trained embedding lookup tables for shared entities; or use TabPFN/TabNet architectures that leverage inductive biases for tabular data. Transfer learning is less established for tabular than CV/NLP and typically only helps when the source and target share the same entity or feature space.' },
      { id: 'ml-expert-1', level: 'expert', text: 'How would you design an ML platform for a company scaling from 10 to 100 data scientists?', referenceAnswer: 'Key components: managed compute (Kubernetes + Spark/Ray), a feature store (online + offline serving), experiment tracking (MLflow, W&B), model registry and versioning, standardised CI/CD pipelines for model deployment, monitoring dashboards. The focus shifts from features to developer experience and guardrails as the team scales — enforce standards via templates and linters rather than process.' },
      { id: 'ml-expert-2', level: 'expert', text: 'How would you build a feature store? Describe the key design decisions for the online vs. offline store.', referenceAnswer: 'Offline store: columnar format (Parquet/Delta) on object storage for batch training, point-in-time correct joins to prevent leakage, partitioned by time and entity. Online store: low-latency key-value (Redis, DynamoDB) for real-time serving. Feature pipeline syncs offline→online. Key decisions: feature materialisation frequency, serving consistency guarantees, backfill strategy, and access control. Feast, Tecton, Hopsworks are common platforms.' },
      { id: 'ml-expert-3', level: 'expert', text: 'Describe a scenario where a model performed well offline but failed in production. What was the root cause and how did you fix it?', referenceAnswer: 'Look for: train/serve skew (different preprocessing in training vs. serving pipelines), label leakage detected retrospectively, concept drift (world changed after training), incorrect business metric proxy (surrogate metric did not match true objective), or cold-start failure for a new entity. The fix should include a monitoring system that would have caught it earlier and a post-mortem.' },
      { id: 'ml-expert-4', level: 'expert', text: 'What is your view on the role of AutoML in large ML organisations?', referenceAnswer: 'AutoML accelerates feature engineering and model selection for well-scoped problems and empowers non-ML practitioners. However, it does not replace deep understanding of the problem, data quality work, business metric alignment, or production engineering. In a large org, AutoML is useful for rapid prototyping and democratising ML access, but bespoke models with domain knowledge outperform it on high-impact, complex tasks.' },
      { id: 'ml-expert-5', level: 'expert', text: 'How do you handle data governance and lineage in a large-scale ML organisation?', referenceAnswer: 'Data lineage tracks the origin and transformations of every dataset and feature used in training, enabling reproducibility, impact analysis of upstream changes, and compliance (GDPR right-to-explanation). Tooling: Apache Atlas, DataHub, or built-in lineage in Delta Lake/dbt. Policy: classify data by sensitivity, enforce access controls at the feature store level, audit access logs, and version all datasets alongside model artifacts in the model registry.' },
      { id: 'ml-expert-6', level: 'expert', text: 'What is your approach to model monitoring, and what would you monitor for a real-time fraud detection model?', referenceAnswer: 'For fraud detection: monitor input feature distributions (PSI for numeric, chi-squared for categorical) against a training baseline; monitor output score distribution; track business KPIs (FPR, FNR, $ fraud caught); alert on sudden spikes or drops. Separately, monitor data pipeline health (SLA, volume). Set up a shadow model alongside production to detect drift before it impacts real users. Schedule periodic retraining triggered by drift or performance degradation.' },
      { id: 'ml-expert-7', level: 'expert', text: 'Describe your approach to building an ML system that operates continuously with minimal manual retraining cycles.', referenceAnswer: 'Continuous learning pipeline: automated data ingestion and validation, triggered retraining when drift metrics or performance thresholds breach, automated model evaluation (canary vs. champion comparison), gated promotion (only deploy if new model passes regression tests), and rollback capability. Avoid full retraining where possible — warm-starting from the previous checkpoint reduces training time. Log all decisions for auditability.' },
      { id: 'ml-expert-8', level: 'expert', text: 'How do you think about the trade-offs between deep learning and gradient boosting for structured tabular data in 2025?', referenceAnswer: 'Gradient boosting (XGBoost, LightGBM, CatBoost) remains the state-of-the-art for most tabular tasks — faster to train, more interpretable, fewer inductive biases to worry about, and requires less data. Deep tabular models (TabNet, FT-Transformer, SAINT) close the gap on large datasets and multi-modal tasks, but rarely dominate on clean tabular benchmarks. Foundation models for tabular data (TabPFN) show promise for low-data regimes. The decision should be empirical on each task.' },
    ],
  },
  /* ── NLP ──────────────────────────────────────────────────────────────── */
  {
    id: 'nlp',
    name: 'NLP & Text Processing',
    questions: [
      { id: 'nlp-fresher-1', level: 'fresher', text: 'What is Natural Language Processing and name three real-world tasks it solves?', referenceAnswer: 'NLP is the field of enabling computers to understand and generate human language. Example tasks: sentiment analysis (determine if a review is positive/negative), machine translation (translate English to French), named entity recognition (extract names of people, organisations, and places from text), and text summarisation.' },
      { id: 'nlp-fresher-2', level: 'fresher', text: 'What is tokenisation in NLP and why does it matter?', referenceAnswer: 'Tokenisation splits raw text into discrete units (tokens) such as words, sub-words, or characters. The choice affects vocabulary size, how rare words are handled, and model context length. Sub-word tokenisation (BPE, WordPiece) balances vocabulary size with the ability to handle unseen words by breaking them into known sub-units.' },
      { id: 'nlp-fresher-3', level: 'fresher', text: 'What is the difference between stemming and lemmatisation?', referenceAnswer: 'Stemming uses rule-based heuristics to strip suffixes (e.g. "running" → "run", "better" → "bett"), producing stems that may not be real words. Lemmatisation uses vocabulary and morphological analysis to return the canonical base form (lemma) of a word ("better" → "good"). Lemmatisation is slower but produces meaningful roots; stemming is faster and often good enough for information retrieval.' },
      { id: 'nlp-fresher-4', level: 'fresher', text: 'What is TF-IDF and how does it differ from raw word counts?', referenceAnswer: 'TF-IDF (Term Frequency–Inverse Document Frequency) weights each word by how often it appears in a document (TF) divided by how common it is across all documents (IDF). Common words like "the" get low IDF weight, while rare but informative words get high weight. Raw counts give equal weight to all words, making common words dominate.' },
      { id: 'nlp-fresher-5', level: 'fresher', text: 'What is Named Entity Recognition (NER) and what are common entity types?', referenceAnswer: 'NER identifies and classifies named entities in text into predefined categories. Common types: PERSON, ORGANISATION, LOCATION/GPE, DATE, TIME, MONEY, PRODUCT, EVENT. It is used in information extraction, knowledge graph construction, question answering, and redacting PII from documents.' },
      { id: 'nlp-fresher-6', level: 'fresher', text: 'What is sentiment analysis and give two examples of where it is applied commercially?', referenceAnswer: 'Sentiment analysis classifies the opinion polarity expressed in text (positive, negative, neutral) or more granularly (emotions, aspect-level sentiment). Commercial uses: monitoring brand sentiment on social media for reputation management; analysing customer support chat transcripts to flag negative experiences for escalation.' },
      { id: 'nlp-fresher-7', level: 'fresher', text: 'What are stop words and in what NLP tasks would you remove them versus keep them?', referenceAnswer: 'Stop words are high-frequency words with little semantic content (the, is, and, of). Remove them for tasks where word distribution matters — keyword extraction, TF-IDF based retrieval, topic modelling. Keep them for tasks where syntactic structure is important — sentiment analysis ("not good" vs "good"), machine translation, and any neural model that learns context from all tokens.' },
      { id: 'nlp-fresher-8', level: 'fresher', text: 'What is a bag-of-words model and what are its key limitations?', referenceAnswer: 'Bag-of-words (BoW) represents a document as a vector of word counts, ignoring word order. Limitations: no semantic meaning (synonyms are unrelated), no word order (negation is lost), high dimensionality and sparsity with large vocabularies, and no context (same word in different senses is identical). Dense word embeddings and contextualised models (BERT) address these limitations.' },
      { id: 'nlp-entry-1', level: 'entry', text: 'What are word embeddings (Word2Vec, GloVe) and how do they capture semantic meaning?', referenceAnswer: 'Word embeddings train dense vectors such that words with similar contexts end up close in the vector space (king – man + woman ≈ queen). Word2Vec uses a shallow neural net with either Skip-gram (predict context from word) or CBOW (predict word from context) objectives. GloVe factorises the global word co-occurrence matrix. Both capture syntactic and semantic relationships but are context-independent (one vector per word).' },
      { id: 'nlp-entry-2', level: 'entry', text: 'What is transfer learning in NLP and why has it transformed the field?', referenceAnswer: 'Pre-training a model on massive text corpora (language modelling, MLM) learns rich language representations; fine-tuning then adapts to a downstream task with a small labelled dataset. This massively reduces the amount of task-specific data needed and achieves state-of-the-art on most benchmarks. BERT (2018) demonstrated this paradigm shift, followed by the GPT family and others.' },
      { id: 'nlp-entry-3', level: 'entry', text: 'What is the difference between extractive and abstractive text summarisation?', referenceAnswer: 'Extractive summarisation selects and concatenates the most important sentences from the source — simpler and factually reliable but may feel stilted. Abstractive summarisation generates new sentences that paraphrase and condense the content — more fluent but risks hallucination. LLMs typically generate abstractive summaries; extractive methods (TextRank, BERTSumExt) are used where faithfulness is critical.' },
      { id: 'nlp-entry-4', level: 'entry', text: 'Explain how BERT is pre-trained and why its representations are powerful for downstream tasks.', referenceAnswer: 'BERT is pre-trained on two tasks: Masked Language Modelling (predict randomly masked tokens using left+right context) and Next Sentence Prediction (classify whether two sentences are consecutive). This gives bidirectional contextualised representations where the same word gets a different vector depending on its context, enabling strong fine-tuning on classification, NER, QA, and other tasks with small datasets.' },
      { id: 'nlp-entry-5', level: 'entry', text: 'What is semantic search and how does it differ from keyword (BM25) search?', referenceAnswer: 'Keyword search (BM25) matches query terms to document terms, requiring exact or stemmed matches. Semantic search encodes queries and documents into dense embedding vectors and retrieves the most similar by cosine distance, finding conceptually related content even without shared vocabulary. Hybrid search combines both for best recall and precision.' },
      { id: 'nlp-entry-6', level: 'entry', text: 'How would you evaluate a machine translation model?', referenceAnswer: 'Automatic metrics: BLEU measures n-gram overlap with reference translations (widely used but correlates poorly with fluency); METEOR and chrF are more nuanced. BERTScore uses contextual embeddings to measure semantic similarity. Human evaluation on fluency and adequacy remains the gold standard. For low-resource languages, back-translation can be used when reference translations are scarce.' },
      { id: 'nlp-entry-7', level: 'entry', text: 'What are common preprocessing steps for building an NLP classifier?', referenceAnswer: 'Lowercasing, punctuation/special-character handling, tokenisation, stop-word removal (if bag-of-words model), and for classical ML: TF-IDF vectorisation or word embedding aggregation. For transformer-based models, the tokeniser handles normalisation; you mainly need to truncate/pad to the model\'s max length and handle encoding/decoding of text labels.' },
      { id: 'nlp-entry-8', level: 'entry', text: 'What is sequence-to-sequence (seq2seq) modelling and give two examples of tasks it solves?', referenceAnswer: 'Seq2seq maps an input sequence to an output sequence of potentially different length using an encoder-decoder architecture. Examples: machine translation (English → French), text summarisation (article → abstract), dialogue generation (question → answer), code generation (docstring → code). Attention mechanisms enable the decoder to focus on relevant encoder states rather than relying solely on a fixed context vector.' },
      { id: 'nlp-intermediate-1', level: 'intermediate', text: 'How would you build a question-answering system over a proprietary document corpus?', referenceAnswer: 'RAG pipeline: chunk documents into overlapping passages, embed with a dense retrieval model (e.g. sentence-transformers/e5), store in a vector DB, retrieve top-k relevant passages on a user query, and pass them to an LLM as context. Add a re-ranker (cross-encoder) for precision. Return cited passages alongside the answer for grounding. Monitor retrieval recall and answer faithfulness separately.' },
      { id: 'nlp-intermediate-2', level: 'intermediate', text: 'How would you detect and handle multilingual text in a production NLP pipeline?', referenceAnswer: 'Language detection: fastText langdetect or langdetect library gives per-document or per-sentence language IDs. For downstream processing: use a multilingual model (mBERT, XLM-R, mT5) that handles many languages natively, or route each language to a language-specific model. For low-resource languages, translation to English as a pre-processing step is a practical fallback.' },
      { id: 'nlp-intermediate-3', level: 'intermediate', text: 'What challenges arise in NER on noisy text (social media, OCR output) and how do you address them?', referenceAnswer: 'Noisy text has: inconsistent capitalisation, abbreviations, misspellings, emojis, informal language, and OCR errors. Approaches: robust tokenisation that handles irregular spacing and punctuation, character-level or sub-word features that tolerate spelling variants, noise-aware pre-training (on tweets, forum text), and post-processing that normalises abbreviations before passing to the NER model.' },
      { id: 'nlp-intermediate-4', level: 'intermediate', text: 'How would you build a text classification model with very few labelled examples (few-shot setting)?', referenceAnswer: 'Options: prompt the LLM with few-shot examples in the context (in-context learning); fine-tune with low-data techniques (SetFit — contrastive fine-tuning of sentence transformers on small labelled sets); zero-shot with a NLI model framing classification as entailment; or apply active learning to select the most informative examples for human labelling next.' },
      { id: 'nlp-intermediate-5', level: 'intermediate', text: 'What are common sources of bias in NLP models and how do they arise?', referenceAnswer: 'Bias comes from training data reflecting societal stereotypes (gender, race, religion), skewed corpus composition (over-representing certain demographics), annotation bias (annotators from similar backgrounds), and task formulation. Biased NER may miss names from minority groups; biased sentiment may rate the same text differently depending on named entities. Mitigations: diverse training data, debiasing post-processing, disaggregated evaluation.' },
      { id: 'nlp-intermediate-6', level: 'intermediate', text: 'What is coreference resolution and why does it matter for information extraction?', referenceAnswer: 'Coreference resolution identifies all mentions in a text that refer to the same real-world entity (e.g. "Elon Musk... he... the CEO... his company"). Without it, relation extraction and knowledge graph construction cannot link disconnected mentions of the same entity. Modern systems (SpanBERT, AllenNLP coref) use span-based architectures and achieve high accuracy on newswire; social media and dialogue remain harder.' },
      { id: 'nlp-intermediate-7', level: 'intermediate', text: 'How would you build a real-time NLP pipeline processing millions of user messages per day?', referenceAnswer: 'Stream messages through Kafka, consume with a microservice fleet (or serverless functions for bursty traffic), batch small requests together for GPU efficiency, serve models with vLLM/TensorRT for throughput. Prioritise: fast lightweight models for high-volume tasks (language detection, spam filter), slower models only for enriched paths. Cache repeated or near-duplicate inputs. Monitor latency P99 and error rate with a circuit breaker for model failure.' },
      { id: 'nlp-intermediate-8', level: 'intermediate', text: 'What chunking strategies would you use when indexing large documents for a RAG system?', referenceAnswer: 'Fixed-size windows: simple but splits sentences mid-thought. Sentence/paragraph chunking: natural boundaries but variable size. Hierarchical chunking: store both paragraph (coarse) and sentence (fine) granularity, retrieve coarse then re-rank fine. Recursive character splitting with overlap: used in LangChain — splits on paragraph, then sentence, then word boundaries with a configurable overlap to preserve context. Overlap is critical to avoid missing answers that straddle chunk boundaries.' },
      { id: 'nlp-advanced-1', level: 'advanced', text: 'How would you design a production-grade information extraction pipeline for unstructured legal documents?', referenceAnswer: 'OCR if needed (Tesseract/AWS Textract) → layout-aware segmentation (identify sections, clauses) → NER for parties, dates, obligations → relation extraction for clause-level linkage → normalization of dates and amounts → structured output (JSON) to a database. Use a domain-adapted model (fine-tuned on legal corpora like CUAD) rather than a generic NER. Post-extraction validation catches extraction errors before they reach downstream systems.' },
      { id: 'nlp-advanced-2', level: 'advanced', text: 'How would you handle very long documents (book-length) in an LLM-based NLP system?', referenceAnswer: 'Options: (1) recursive summarisation — split into chunks, summarise each, then summarise summaries; (2) retrieval — embed chunks and retrieve only the relevant passage for the specific question; (3) long-context models (Gemini 1.5M, Claude 200k) — useful but expensive and attention degrades in very long ranges; (4) sliding window with overlap for sequential tasks. For production, combining retrieval + a long-context model for final synthesis often gives the best cost-quality trade-off.' },
      { id: 'nlp-advanced-3', level: 'advanced', text: 'How do you evaluate a conversational AI system at scale beyond simple accuracy metrics?', referenceAnswer: 'Automatic: task completion rate, intent recognition accuracy, slot-filling precision, BLEU/ROUGE for response quality, LLM-as-judge on helpfulness/safety rubric. Human: regular sample-based review for fluency, factual accuracy, and policy compliance. Business: CSAT, resolution rate, escalation rate, handle time. Run periodic red-team adversarial evals. Track metrics disaggregated by domain, user cohort, and language.' },
      { id: 'nlp-advanced-4', level: 'advanced', text: 'Describe how you would build a text de-identification system for healthcare records (remove PHI).', referenceAnswer: 'PHI includes names, dates, locations, phone numbers, account numbers, etc. (HIPAA 18 identifiers). Pipeline: fine-tune a NER model (e.g. on i2b2 dataset) to tag PHI spans, then apply rule-based post-processing (regex for phone/date formats, dictionary lookup for names), replace tagged spans with synthetic placeholders or category labels. Evaluate recall rigorously — missing PHI is more harmful than over-redaction. Audit with clinical privacy experts.' },
      { id: 'nlp-advanced-5', level: 'advanced', text: 'What is cross-lingual transfer and when would you use it versus training a language-specific model?', referenceAnswer: 'Cross-lingual transfer uses a multilingual model (XLM-R, mBERT) fine-tuned on a high-resource language (English) and evaluated on a low-resource target language with no target-language fine-tuning data. It is useful for bootstrapping NLP for low-resource languages. Train a language-specific model when you have sufficient monolingual data and need to squeeze out the last few points of accuracy — language-specific models typically outperform multilingual ones on the same language.' },
      { id: 'nlp-advanced-6', level: 'advanced', text: 'How would you build an enterprise semantic search system that outperforms BM25 on domain-specific queries?', referenceAnswer: 'Baseline BM25 with domain-specific stoplist tuning. Improve: (1) dense retrieval with a bi-encoder fine-tuned on domain QA pairs (in-domain hard-negative mining); (2) re-ranking layer (cross-encoder) on top-k results for precision; (3) hybrid BM25 + dense fusion (RRF or score interpolation); (4) query expansion using LLM-generated alternatives. Evaluate with domain-specific NDCG and MRR. Collect relevance feedback from users for iterative improvement.' },
      { id: 'nlp-advanced-7', level: 'advanced', text: 'How would you monitor NLP model quality in production and trigger retraining?', referenceAnswer: 'Monitor: input text distribution shift (vocabulary drift, topic drift via LDA/clustering), output distribution (label proportions, confidence score distribution), and business KPIs. For labelled tasks, collect periodic human annotations on production samples and compare to model predictions. Set alert thresholds for each metric. Automated retraining trigger: when rolling-window accuracy drops below threshold OR when drift detector (PSI, KS test) signals significant input shift.' },
      { id: 'nlp-advanced-8', level: 'advanced', text: 'What are the key challenges of building multilingual NLP for 50+ languages in a production system?', referenceAnswer: 'Resource imbalance: most training data is English — performance degrades for low-resource languages. Language-specific phenomena: morphologically rich languages (Turkish, Finnish) require different tokenisation. Model capacity: a single multilingual model may be capacity-starved across many languages. Infrastructure: language detection, routing, and locale-specific postprocessing add complexity. Strategy: tier languages by priority, use multilingual models for long-tail, language-specific for top languages, and monitor per-language quality independently.' },
      { id: 'nlp-expert-1', level: 'expert', text: 'How would you build an NLP system for a specialised domain where labelled data is scarce but domain experts exist?', referenceAnswer: 'Strategies: (1) domain-adaptive pre-training — continue pre-training a foundation model on domain-specific unlabelled text (PubMed, legal corpora); (2) active learning — use uncertainty sampling to have experts label the most informative examples; (3) LLM-assisted labelling — generate weak labels with GPT-4, validate with domain experts on a subset; (4) synthetic data generation via LLM for rare event types; (5) cross-domain transfer from related labelled datasets.' },
      { id: 'nlp-expert-2', level: 'expert', text: 'What is your view on the future of specialised NLP models versus large general-purpose LLMs for enterprise tasks?', referenceAnswer: 'Large LLMs dominate most NLP tasks via in-context learning but carry cost, latency, and data privacy concerns. Specialised smaller models (fine-tuned on domain data) offer lower inference cost, on-prem deployability, and better domain accuracy for well-scoped tasks (NER, classification). The winning strategy is a portfolio: LLMs for complex, low-volume tasks; specialised models for high-volume, narrowly-defined production tasks. RAG bridges the gap for knowledge-intensive tasks.' },
      { id: 'nlp-expert-3', level: 'expert', text: 'How would you approach responsible NLP at scale — bias, toxicity detection, and privacy in large language systems?', referenceAnswer: 'Bias: diverse training data, disaggregated evaluation across demographic axes, fairness constraints in fine-tuning. Toxicity: multi-layer content moderation (classifier + keyword rules + human review for edge cases), output filtering before display, red-team adversarial probing. Privacy: PII detection and redaction from training data, differential privacy for fine-tuning, strict data minimisation, and output scanning to prevent memorisation leakage. All of these require ongoing monitoring — not one-time fixes.' },
      { id: 'nlp-expert-4', level: 'expert', text: 'Describe how you would build an NLP evaluation benchmark from scratch for a specialised industry vertical.', referenceAnswer: 'Define task taxonomy covering all key use-cases (extraction, QA, classification, summarisation). Collect diverse source documents representative of real production inputs. Work with domain experts for annotation guidelines (inter-annotator agreement > 0.8 Cohen\'s kappa). Curate a balanced test set with edge cases, adversarial examples, and underrepresented categories. Publish with a leaderboard and clear rules on forbidden training data overlap. Re-audit benchmark for contamination when new models are released.' },
      { id: 'nlp-expert-5', level: 'expert', text: 'How do you think about combining knowledge graphs with LLMs for enterprise NLP applications?', referenceAnswer: 'LLMs excel at fluent language generation and reasoning but struggle with precise factual recall and structured data. Knowledge graphs provide reliable structured facts and explicit entity relationships. Hybrid: use LLM to parse intent and generate a SPARQL/Cypher query, execute against the KG, inject structured results into the LLM prompt for answer synthesis. The KG acts as an auditable factual backbone; the LLM handles language. Challenges: KG freshness, entity linking between text mentions and KG nodes.' },
      { id: 'nlp-expert-6', level: 'expert', text: 'How would you architect an NLP platform that lets 50+ data scientists experiment with models while maintaining production reliability?', referenceAnswer: 'Tiered environment: sandbox (notebooks on shared GPU clusters with no production access), staging (full pipeline integration tests with production-like data volumes), production (locked-down deployment with approval workflow). Shared tooling: a standard NLP library with pre-built preprocessing, evaluation harnesses, and deployment interfaces. Guardrails: mandatory eval gates (precision/recall on held-out set, bias checklist, latency SLA) before promotion. Feature flag system so experiments can ramp traffic gradually.' },
      { id: 'nlp-expert-7', level: 'expert', text: 'Describe your approach to building a large-scale annotation pipeline for training NLP models that requires thousands of labelled examples.', referenceAnswer: 'Annotation quality is the bottleneck, not quantity. Steps: precise annotation guidelines with worked examples and edge-case decisions documented; training and calibration of annotators; multi-annotator redundancy for difficult examples with inter-annotator agreement measurement (Cohen\'s kappa target > 0.8); adjudication workflow for disagreements; active learning to prioritise the most informative examples for labelling; automated quality checks that flag annotator drift; tiered annotator structure (generalists for easy labels, experts for ambiguous cases).' },
      { id: 'nlp-expert-8', level: 'expert', text: 'How would you approach multi-modal NLP — combining text with tabular, image, or audio data — in a production system?', referenceAnswer: 'Modality-specific encoders: a text encoder (sentence-transformer or LLM), image encoder (ViT/CLIP), and audio encoder (Whisper embeddings). Fusion strategies: early fusion (concatenate embeddings before a classifier), late fusion (ensemble predictions per modality), or cross-modal attention (a shared transformer attends across modality tokens). Production considerations: different modality encoders have different latency/cost profiles — only invoke the modalities present in the input; use asynchronous parallel encoding; cache embeddings for static content.' },
    ],
  },
  /* ── MLOps & Data Engineering ──────────────────────────────────────────── */
  {
    id: 'mlops-data-engineering',
    name: 'MLOps & Data Engineering',
    questions: [
      { id: 'mlops-fresher-1', level: 'fresher', text: 'What is MLOps and why has it become important for production ML systems?', referenceAnswer: 'MLOps (ML Operations) applies DevOps principles to machine learning — automating the build, test, deploy, and monitor lifecycle of ML models. Without it, models trained in a notebook rarely make it to reliable production: they suffer from training-serving skew, model decay, and manual deployment toil. MLOps creates repeatable, auditable pipelines from raw data to serving.' },
      { id: 'mlops-fresher-2', level: 'fresher', text: 'What is the difference between batch processing and stream (real-time) processing in a data pipeline?', referenceAnswer: 'Batch processing runs periodic jobs on accumulated data (hourly, daily) — higher latency but simpler and cheaper. Stream processing handles each event as it arrives with sub-second latency — needed for real-time fraud detection, recommendations, or live dashboards but is more complex to build and operate (exactly-once semantics, fault tolerance).' },
      { id: 'mlops-fresher-3', level: 'fresher', text: 'What is a model registry and why is it used in ML systems?', referenceAnswer: 'A model registry is a centralised catalogue that stores versioned model artifacts (weights, configs, metrics) alongside metadata (training run, dataset version, evaluation results). It enables reproducibility, rollback to previous versions, comparison of model performance across versions, approval workflows before production deployment, and governance.' },
      { id: 'mlops-fresher-4', level: 'fresher', text: 'What is experiment tracking and which tools are commonly used for it?', referenceAnswer: 'Experiment tracking records the hyperparameters, dataset versions, code commits, metrics, and artifacts for each ML training run so results are reproducible and comparable. Common tools: MLflow (open-source, self-hosted), Weights & Biases (managed, strong UI), Comet ML, Aim. Without it, re-creating a past result or understanding why one run outperformed another is nearly impossible.' },
      { id: 'mlops-fresher-5', level: 'fresher', text: 'What is a Docker container and why is it useful for deploying ML models?', referenceAnswer: 'A Docker container packages the model, its code, runtime dependencies, and OS libraries into a portable, reproducible image that runs the same on any machine. This eliminates "works on my machine" problems. For ML: packages Python, CUDA libraries, and model weights together, enabling consistent local development, CI testing, and cloud deployment from a single artifact.' },
      { id: 'mlops-fresher-6', level: 'fresher', text: 'What is data versioning and why does it matter in ML projects?', referenceAnswer: 'Data versioning tracks changes to datasets over time so you can reproduce past training runs, audit what data a model was trained on, and roll back to a previous dataset version if a data quality issue is found. Tools: DVC (git-like for large files), Delta Lake / Apache Iceberg (ACID tables with time-travel), lakeFS. Without versioning, re-creating a model trained months ago is difficult.' },
      { id: 'mlops-fresher-7', level: 'fresher', text: 'What is CI/CD and how does it apply to machine learning?', referenceAnswer: 'CI (Continuous Integration) runs automated tests on every code commit — for ML this means unit tests of preprocessing, model loading, and prediction shapes. CD (Continuous Delivery/Deployment) automates the path from a passing CI build to production. ML-CI also runs model evaluation on a validation set and gates deployment on performance thresholds, not just code correctness.' },
      { id: 'mlops-fresher-8', level: 'fresher', text: 'What is Apache Airflow (or an equivalent tool) and how is it used in ML pipelines?', referenceAnswer: 'Airflow is a workflow orchestration platform where you define pipelines as Directed Acyclic Graphs (DAGs) in Python. Each node is a task (data extraction, feature computation, model training, evaluation). Airflow handles scheduling, dependency management, retries on failure, logging, and alerting. Alternatives: Prefect, Dagster, Metaflow, Kubeflow Pipelines.' },
      { id: 'mlops-entry-1', level: 'entry', text: 'Describe a typical workflow for deploying a trained ML model as a REST API endpoint.', referenceAnswer: 'Serialise the model (pickle, ONNX, SavedModel). Build a serving container (Flask/FastAPI app or a dedicated serving framework — Triton, TorchServe, BentoML). Write an inference handler: load model at startup, deserialise input, call model.predict(), serialise output. Containerise with Docker. Deploy to Kubernetes or a managed service (SageMaker endpoint, Cloud Run). Add health checks, logging, and a /metrics endpoint for Prometheus.' },
      { id: 'mlops-entry-2', level: 'entry', text: 'What is feature drift, and how would you detect it in a production ML system?', referenceAnswer: 'Feature drift (covariate shift) is when the distribution of input features in production differs from the training distribution, degrading model performance. Detection: compute statistical tests on a rolling window of production data vs. training data — Population Stability Index (PSI) for numerical features, chi-squared for categorical. Alert when PSI > 0.25 (significant shift). Also monitor output score distribution.' },
      { id: 'mlops-entry-3', level: 'entry', text: 'What metrics would you monitor for a classification model in production?', referenceAnswer: 'Technical: input feature distributions (drift), prediction score distribution, prediction class distribution, model latency (P50, P95, P99), error rate. Business KPIs: precision, recall, and F1 on a labelled production sample, conversion rate (for recommendation), fraud caught vs. false positives (for fraud detection). Set up alerts for threshold violations on all key metrics.' },
      { id: 'mlops-entry-4', level: 'entry', text: 'What is the difference between online and offline feature serving in a feature store?', referenceAnswer: 'Offline serving reads features from a columnar store (Parquet/Delta) during batch training — designed for high throughput and point-in-time correctness to avoid leakage. Online serving reads from a low-latency key-value store (Redis, DynamoDB) during real-time inference — designed for single-entity lookups in <10ms. Keeping both in sync (materialisation pipeline) and consistent is a core challenge of feature store design.' },
      { id: 'mlops-entry-5', level: 'entry', text: 'What is a model serving framework and why use one instead of a plain Flask API?', referenceAnswer: 'Dedicated serving frameworks (NVIDIA Triton, TorchServe, BentoML) provide: dynamic batching to improve GPU throughput, model versioning and A/B routing, ensemble pipelines, gRPC and HTTP endpoints, hardware-accelerated backends (TensorRT), and built-in metrics. A plain Flask API would require you to build all of this yourself and is typically not hardware-optimised.' },
      { id: 'mlops-entry-6', level: 'entry', text: 'How would you implement automated data quality checks in a data pipeline?', referenceAnswer: 'Define expectations for each dataset column: type, nullability, range, uniqueness, referential integrity. Run checks after each pipeline stage using Great Expectations, dbt tests, or Pandera. Fail the pipeline (halt downstream) on critical violations, warn on lower-severity. Log check results for audit. Add schema evolution checks to catch upstream schema changes that break downstream models.' },
      { id: 'mlops-entry-7', level: 'entry', text: 'How do you version control datasets in a machine learning project?', referenceAnswer: 'For large files use DVC (git-like pointer files committed to git; actual data stored in S3/GCS/Azure Blob). For structured data, Delta Lake or Apache Iceberg provide ACID transactions and time-travel on data lakes. Always commit the dataset version or snapshot ID alongside the model artifact and code commit in the experiment tracking system so any training run can be reproduced exactly.' },
      { id: 'mlops-entry-8', level: 'entry', text: 'What is a blue-green deployment strategy and how is it applied to ML model updates?', referenceAnswer: 'Blue-green deployment runs two identical production environments — one live (blue), one staging the new version (green). Traffic is switched atomically from blue to green once green passes validation, enabling instant rollback by switching back. For ML: run the new model in shadow mode (receives real traffic, predictions logged but not served) to validate quality before switch, then cut over with a feature flag or load balancer change.' },
      { id: 'mlops-intermediate-1', level: 'intermediate', text: 'Design a batch inference pipeline for running a large ML model over 1 billion records per day.', referenceAnswer: 'Partition data into shards; process each shard on a distributed compute cluster (Spark, Ray, Dask on Kubernetes). Use GPU-enabled workers with the model loaded once per worker (not once per record). Serialise outputs to columnar format (Parquet) partitioned by date. Use a queue (Kafka/SQS) to decouple ingestion from processing. Monitor throughput, failure rate, and cost per record. Design for idempotent reruns of failed shards.' },
      { id: 'mlops-intermediate-2', level: 'intermediate', text: 'How would you detect and respond to model performance degradation in production?', referenceAnswer: 'Collect ground-truth labels on a sample of production predictions (delayed labels, human annotation). Compute metrics (precision, recall, AUC) on rolling windows and compare to baseline. Alert if metric drops below threshold. Short-term: switch traffic to a stable previous model version. Medium-term: investigate root cause (data drift, label shift, infrastructure bug). Long-term: trigger retraining with fresh data and deploy via canary.' },
      { id: 'mlops-intermediate-3', level: 'intermediate', text: 'Describe how Spark or another distributed processing framework is used in a production ML feature pipeline.', referenceAnswer: 'Spark distributes computation across a cluster, enabling feature engineering at petabyte scale. A typical pipeline: read raw data from a data lake (Delta/Iceberg), apply groupBy-aggregations to compute entity-level features (e.g. user 30-day purchase sum), write time-stamped feature rows to the offline store. Use Spark Structured Streaming for near-real-time feature updates. Manage cluster resources with EMR (AWS) or Dataproc (GCP), or self-managed on Kubernetes.' },
      { id: 'mlops-intermediate-4', level: 'intermediate', text: 'What is a data lakehouse and how does it improve on a traditional data lake?', referenceAnswer: 'A data lake stores raw files (Parquet, CSV) with no transactional guarantees — no updates, no schema enforcement, no ACID. A lakehouse adds a transactional metadata layer (Delta Lake, Apache Iceberg, Apache Hudi) on top: ACID transactions (supporting upserts and deletes), time-travel (query data as of a past version), schema evolution, and unified batch + streaming. This eliminates the need for a separate OLAP warehouse while keeping storage costs low.' },
      { id: 'mlops-intermediate-5', level: 'intermediate', text: 'How would you implement automated model retraining triggered by data drift?', referenceAnswer: 'Drift monitor (running in production) computes PSI or KL divergence on input features vs. training baseline at regular intervals. When drift exceeds a threshold, it publishes an event to a trigger topic (Kafka or SNS). A retraining pipeline (Airflow DAG or Kubeflow pipeline) is triggered: pull fresh data, validate quality, train on an expanded dataset, evaluate against champion model on a fixed test set, promote if improvement meets threshold, deploy via canary, monitor for stability.' },
      { id: 'mlops-intermediate-6', level: 'intermediate', text: 'What are the key considerations when building a feature store, and what are the trade-offs between different implementations?', referenceAnswer: 'Key considerations: point-in-time correctness for training joins, online-offline consistency, backfill capability, access control, feature discovery/documentation. Managed (Tecton, Feast-on-cloud): faster to adopt, less ops, but higher cost and lock-in. Self-hosted (Feast OSS + Redis + Spark): full control, cheaper at scale, but higher engineering investment. The biggest architectural decision is the online store technology — Redis for low latency, DynamoDB for scale-out, Bigtable for heavy throughput.' },
      { id: 'mlops-intermediate-7', level: 'intermediate', text: 'What is the difference between model monitoring and data monitoring, and what tools would you use for each?', referenceAnswer: 'Data monitoring checks the health and distribution of input data before it reaches the model — schema validation, null rates, cardinality shifts, volume anomalies (Great Expectations, Soda, Monte Carlo). Model monitoring tracks the model\'s behaviour and output quality in production — prediction distribution shift, concept drift, latency, error rate (Evidently AI, Arize, WhyLabs, custom dashboards in Grafana). Both are necessary; data issues often surface before model degradation.' },
      { id: 'mlops-intermediate-8', level: 'intermediate', text: 'How would you use Kubernetes to deploy and scale a fleet of ML model inference services?', referenceAnswer: 'Package each model as a Docker image in a Deployment with resource requests/limits (CPU, GPU, memory). Expose via a Service + Ingress. Use HorizontalPodAutoscaler to scale on request latency or queue depth (custom metrics via KEDA). Use node pools with GPU nodes and auto-provisioner for GPU workloads. Mount model weights from a shared NFS/object storage PVC. Use PodDisruptionBudgets for rolling updates without downtime. Canary deployments via Argo Rollouts or Istio traffic splitting.' },
      { id: 'mlops-advanced-1', level: 'advanced', text: 'Design a real-time feature engineering pipeline for a fraud detection model requiring sub-10ms feature serving.', referenceAnswer: 'Pre-materialise aggregates asynchronously: a Flink/Spark Streaming job consumes raw transaction events, computes aggregations (count_7d, sum_amount_1h per card) and writes to Redis with TTL. At inference time, the feature server does a Redis multi-GET in <2ms. For features that can\'t be pre-materialised, compute them inline using a fast lookup (user profile cache). Use Lua scripts in Redis for atomic read-modify-write aggregations. Monitor p99 feature retrieval latency as a production SLO.' },
      { id: 'mlops-advanced-2', level: 'advanced', text: 'How would you migrate a large organisation from ad-hoc ML experimentation to a standardised MLOps workflow?', referenceAnswer: 'Phased approach: (1) introduce experiment tracking (MLflow/W&B) — low friction, high immediate value; (2) standardise training pipelines as code with templates and linters; (3) add a model registry with approval workflow; (4) automate CI tests for models; (5) introduce a feature store for reuse; (6) add monitoring dashboards. Change management: lead with pain points and early wins, not mandate. Get buy-in from influential senior data scientists.' },
      { id: 'mlops-advanced-3', level: 'advanced', text: 'How would you architect an ML platform serving both training and serving needs across multiple teams?', referenceAnswer: 'Shared infrastructure layer: managed compute (Kubernetes + auto-scaling GPU pools), shared object storage for data, model registry, and monitoring stack. Team-specific namespaces for isolation. Self-service templates (helm charts, Terraform modules) so teams can deploy their own training jobs and serving endpoints without platform team bottlenecks. A data contract layer ensures teams can safely share datasets. Centralised cost attribution to each team.' },
      { id: 'mlops-advanced-4', level: 'advanced', text: 'What are the trade-offs between Kubernetes-native ML serving and managed serving platforms (SageMaker, Vertex AI)?', referenceAnswer: 'Kubernetes-native (Seldon, KServe): full control, portable, open-source, no vendor lock-in, but higher ops burden (cluster management, scaling, security). Managed platforms (SageMaker, Vertex AI): faster time to value, auto-scaling, integrated monitoring, no cluster management, but cloud lock-in and higher per-request cost at scale. Decision drivers: existing cloud commitment, team Kubernetes expertise, regulatory requirements for data residency, and scale of serving traffic.' },
      { id: 'mlops-advanced-5', level: 'advanced', text: 'Describe how you would implement model governance with audit logging and lineage tracking for a regulated industry.', referenceAnswer: 'Model registry must capture: training dataset version, code commit, hyperparameters, evaluation metrics, and approver sign-off. Every inference must log: model version, input hash, output, timestamp, and requesting entity. Use immutable audit logs (append-only store, e.g. AWS CloudTrail + S3 with object lock). Lineage tracking (Apache Atlas or DataHub) links model artifacts to their training data. Document decisions in a model card reviewed by compliance before production promotion.' },
      { id: 'mlops-advanced-6', level: 'advanced', text: 'How would you approach a data mesh architecture in a large enterprise with many data-producing teams?', referenceAnswer: 'Data mesh decentralises data ownership: each domain team owns its data products end-to-end (ingestion, quality, serving, SLAs) rather than a central data team doing everything. Infrastructure platform provides self-service tooling (data catalogue, quality framework, standard data contracts). Federated governance enforces interoperability (standardised schemas, access control, lineage). Key challenges: enforcing standards without re-centralising control, and aligning incentives for teams to maintain data quality.' },
      { id: 'mlops-advanced-7', level: 'advanced', text: 'How would you design the data and ML infrastructure for a system that must be auditable and explainable for regulatory compliance?', referenceAnswer: 'All training data must have documented provenance and consent, version-controlled and immutable once used for a production model. The model must produce explainability scores per prediction (SHAP) that are logged alongside the decision. A human review workflow must be supported for high-stakes decisions. Evaluation must include disaggregated fairness metrics. All of this must be queryable for regulatory examination. Prefer simpler, more interpretable model families for highest-stakes decisions.' },
      { id: 'mlops-advanced-8', level: 'advanced', text: 'What are the key failure modes in production ML systems at scale, and how do you build resilience against them?', referenceAnswer: 'Key failures: silent data quality degradation (monitoring + alerting), training-serving skew (unit-test preprocessing code, compare training and serving feature distributions), model rot (performance monitoring, scheduled retraining), infrastructure outages (circuit breakers, fallback to simpler rule-based model), and cascading failures in multi-model pipelines (timeouts, bulkheads, graceful degradation). Chaos engineering: regularly simulate failures to test resilience mechanisms.' },
      { id: 'mlops-expert-1', level: 'expert', text: 'Describe how you would design an ML infrastructure platform for a company with 200+ data scientists and 50+ models in production.', referenceAnswer: 'Platform pillars: self-service compute (Kubernetes + Ray/Spark clusters), shared data layer (lakehouse + feature store), unified experiment tracking and model registry, standardised deployment templates with built-in monitoring. Team structure: dedicated platform team with service-level commitments to data science teams. Governance layer: model risk management framework, mandatory eval gates, auditability. Cost optimisation: spot instances for training, auto-scaling serving, per-team cost attribution dashboards.' },
      { id: 'mlops-expert-2', level: 'expert', text: 'What is your view on LLMOps — how MLOps practices need to evolve specifically for LLM pipelines?', referenceAnswer: 'LLMOps differs from classical MLOps in several ways: evaluation is harder (no ground truth for open-ended generation — need LLM-as-judge or human eval); prompt versioning is a first-class concern alongside model versioning; fine-tuning workflows involve adapter management (LoRA checkpoints) not full model checkpoints; RAG pipelines need index versioning and retrieval quality monitoring; cost per inference is orders of magnitude higher requiring aggressive caching and model routing. Tooling: LangSmith, PromptLayer, Weights & Biases Prompts.' },
      { id: 'mlops-expert-3', level: 'expert', text: 'How would you design a data platform serving both real-time analytics and ML training workloads efficiently?', referenceAnswer: 'Unified storage layer: Delta Lake / Iceberg on object storage — single source of truth for both workloads, eliminating ETL duplication. Real-time analytics path: stream raw events into the lakehouse via Kafka + Flink; materialise pre-computed aggregates to a serving layer (DuckDB or Snowflake for ad-hoc, Redis for dashboards). ML training path: same lakehouse, with point-in-time join support for feature extraction. Compute separation: dedicated Spark/Ray clusters for ML training, separate Trino/Snowflake for analytics to avoid resource contention.' },
      { id: 'mlops-expert-4', level: 'expert', text: 'How do you think about the build-vs-buy decision for ML infrastructure components (feature store, model registry, serving)?', referenceAnswer: 'Build only if: the component is a genuine competitive differentiator, existing tools cannot meet the technical requirements (latency, scale, privacy), and you have the engineering bandwidth to sustain it. Buy/managed for: commodity components where vendor tools meet requirements (experiment tracking — W&B; model registry — MLflow hosted; serving — SageMaker). The highest-leverage component to build in-house is typically the feature store, because it encodes domain business logic that no vendor can know. Everything else defaults to managed.' },
      { id: 'mlops-expert-5', level: 'expert', text: 'Describe how you would handle the operational complexity of managing hundreds of ML models in production with different SLAs.', referenceAnswer: 'Model catalogue: each model registered with SLA tier (critical/standard/batch), owner, monitoring thresholds, and runbook link. Tier-differentiated infrastructure: critical models get dedicated GPU pods + PagerDuty alerts; standard models on shared pools; batch models on spot instances with SLA on job completion time. Centralised monitoring platform with per-model health dashboards. Automated remediation: circuit breaker switches to fallback model on latency breach. Quarterly model reviews: retire models with no traffic or poor ROI.' },
      { id: 'mlops-expert-6', level: 'expert', text: 'How would you build a self-healing ML pipeline that automatically detects and recovers from data quality failures without human intervention?', referenceAnswer: 'Each pipeline stage has embedded data quality checks (volume, null rate, schema conformance, statistical bounds). On failure: classify severity — low-severity anomalies trigger an alert and continue with flagged data; high-severity triggers a halt, quarantines the bad partition, and attempts re-ingestion from source if available. For recurring failures, an ML-based anomaly detector on pipeline telemetry can spot patterns before they cascade. Weekly drill to test the automated recovery path. Root-cause logging enables retrospective analysis.' },
      { id: 'mlops-expert-7', level: 'expert', text: 'What is your approach to cost attribution and chargeback for ML infrastructure in a multi-team organisation?', referenceAnswer: 'Tag all cloud resources (GPU instances, storage, data transfer) by team and project at the infrastructure level. Instrument training jobs with cost-tracking metadata. Build a cost dashboard per team showing training compute, data storage, and serving costs separately. Set per-team budgets with alerts at 70%/90%/100% usage. For shared infrastructure, allocate costs by usage (GPU-hours, storage GB). Publish weekly cost reports to team leads — visibility alone drives significant savings without mandating behaviour changes.' },
      { id: 'mlops-expert-8', level: 'expert', text: 'How would you design an MLOps platform that supports both deep learning (GPU workloads) and classical ML (CPU workloads) with optimal resource utilisation?', referenceAnswer: 'Separate node pools: GPU-enabled nodes (autoscaled, spot/preemptible for training) and CPU-only nodes (cheaper, for classical ML and preprocessing). Intelligent job scheduler (Volcano, Kueue) that packs CPU jobs densely and places DL jobs on GPU nodes only when needed. Priority queues: interactive/experimentation gets low-priority preemptible resources; production training gets on-demand. Shared storage layer accessible from both node types. Profiling: enforce GPU utilisation thresholds — reject jobs that request GPUs but use less than 30% (common waste). Track cost-per-model-accuracy-point as the key efficiency metric.' },
    ],
  },
  /* ── Java, Spring Boot & Cloud ─────────────────────────────────────────── */
  {
    id: 'java-spring-cloud',
    name: 'Java, Spring Boot & Cloud',
    questions: [
      { id: 'java-fresher-1', level: 'fresher', text: 'What are the four pillars of Object-Oriented Programming in Java? Briefly explain each.', referenceAnswer: 'Encapsulation: bundling data and methods together and restricting direct access via private/protected fields. Inheritance: a subclass inherits state and behaviour from a parent class. Polymorphism: a single interface representing different underlying types (method overriding, interfaces). Abstraction: exposing only essential behaviour through abstract classes and interfaces, hiding implementation details.' },
      { id: 'java-fresher-2', level: 'fresher', text: 'What is the difference between an interface and an abstract class in Java?', referenceAnswer: 'An interface defines a contract (method signatures, default methods, constants) with no state, and a class can implement multiple interfaces. An abstract class can have instance fields, constructors, concrete methods, and state, but a class can only extend one abstract class. Choose abstract class when sharing common state/logic; choose interface when defining a capability contract.' },
      { id: 'java-fresher-3', level: 'fresher', text: 'What problem does the Spring Framework solve and what is dependency injection?', referenceAnswer: 'Spring solves the coupling problem by managing object lifecycles and their dependencies through an IoC (Inversion of Control) container. Dependency injection means the container creates and "injects" dependencies into a class (via constructor, setter, or field injection) rather than the class creating them with new, making classes independently testable and loosely coupled.' },
      { id: 'java-fresher-4', level: 'fresher', text: 'What is a REST API and what are the standard HTTP methods and their semantics?', referenceAnswer: 'REST (Representational State Transfer) is an architectural style for stateless client-server communication over HTTP. Methods: GET (retrieve, safe, idempotent), POST (create), PUT (replace, idempotent), PATCH (partial update), DELETE (remove, idempotent). Resources are identified by URIs; the server returns representations (typically JSON) and appropriate status codes (200, 201, 404, etc.).' },
      { id: 'java-fresher-5', level: 'fresher', text: 'What is cloud computing and what are the three main service models?', referenceAnswer: 'Cloud computing delivers computing resources (servers, storage, databases, networking) over the internet on a pay-as-you-go basis. IaaS (Infrastructure as a Service): raw compute, networking, storage (EC2, GCE). PaaS (Platform as a Service): managed runtime environment (Elastic Beanstalk, Cloud Run). SaaS (Software as a Service): complete applications delivered over the internet (Salesforce, Gmail).' },
      { id: 'java-fresher-6', level: 'fresher', text: 'What is the difference between a relational and a NoSQL database? Give an example of each.', referenceAnswer: 'Relational databases store data in structured tables with a fixed schema and relationships enforced by foreign keys, queried with SQL (PostgreSQL, MySQL). NoSQL databases trade schema flexibility and horizontal scale for full ACID guarantees — document stores (MongoDB), key-value (Redis), wide-column (Cassandra), or graph (Neo4j). Choose relational for complex relational queries and transactions; NoSQL for scale, flexibility, or specialised access patterns.' },
      { id: 'java-fresher-7', level: 'fresher', text: 'What is a microservice and how does it differ from a monolithic application?', referenceAnswer: 'A monolith bundles all functionality into a single deployable unit — simple to develop initially but becomes hard to scale and change independently. A microservice architecture decomposes the application into small, independently deployable services, each owning its data and business capability, communicating over APIs. Benefits: independent deployability, targeted scaling, technology flexibility. Costs: distributed system complexity, network latency, operational overhead.' },
      { id: 'java-fresher-8', level: 'fresher', text: 'What is the difference between == and .equals() in Java?', referenceAnswer: '== compares object references (memory addresses) for objects, and values for primitives. .equals() compares logical equality based on the object\'s equals() override — for String and value types, this compares content. Always use .equals() to compare String values; == will only be true if they are the same object reference, which is only guaranteed for string literals due to interning.' },
      { id: 'java-entry-1', level: 'entry', text: 'What is Spring Boot and how does it simplify Spring application development?', referenceAnswer: 'Spring Boot provides auto-configuration (convention over configuration), embedded servers (Tomcat/Jetty/Undertow), starter dependencies (spring-boot-starter-web bundles everything for a REST API), and production-ready Actuator endpoints. You get a runnable JAR with a main method instead of a WAR file needing an application server. This eliminates XML configuration boilerplate and reduces setup from hours to minutes.' },
      { id: 'java-entry-2', level: 'entry', text: 'Explain Spring Bean scopes. What is the difference between singleton and prototype scope?', referenceAnswer: 'Singleton (default): one instance per Spring application context, shared across all injection points — use for stateless services. Prototype: a new instance is created each time the bean is requested — use for stateful beans. Other web scopes: Request (one per HTTP request), Session (one per HTTP session). The wrong scope can cause subtle bugs — injecting a prototype bean into a singleton loses the prototype semantics without using ObjectProvider or a proxy.' },
      { id: 'java-entry-3', level: 'entry', text: 'What is JPA / Hibernate and how does it simplify database access?', referenceAnswer: 'JPA (Java Persistence API) is a specification for ORM (Object-Relational Mapping) — it maps Java classes to database tables and Java fields to columns, so you work with objects rather than SQL. Hibernate is the most common JPA implementation. Spring Data JPA further reduces boilerplate: defining a JpaRepository interface auto-generates CRUD and query methods without writing SQL.' },
      { id: 'java-entry-4', level: 'entry', text: 'What is the difference between synchronous and asynchronous processing in Java? Give an example use case for async.', referenceAnswer: 'Synchronous processing blocks the calling thread until the operation completes. Asynchronous processing returns immediately; the result is delivered via a callback, CompletableFuture, or reactive stream. Use async for I/O-bound work (calling an external API, sending an email notification) to avoid blocking a request thread and improve throughput. Java\'s @Async annotation and CompletableFuture are common approaches in Spring.' },
      { id: 'java-entry-5', level: 'entry', text: 'How does Spring Security handle authentication and authorisation?', referenceAnswer: 'Authentication establishes identity — Spring Security intercepts requests via a filter chain, extracts credentials (username/password, JWT, OAuth2 token), delegates to an AuthenticationProvider, and populates a SecurityContext with the authenticated principal. Authorisation controls access — @PreAuthorize and method security annotations, or HttpSecurity rules, check the principal\'s roles/permissions against protected endpoints or methods.' },
      { id: 'java-entry-6', level: 'entry', text: 'What is an API Gateway in a microservices architecture and what responsibilities does it handle?', referenceAnswer: 'An API Gateway is the single entry point for all client requests. Responsibilities: request routing to backend services, authentication/authorisation, rate limiting, SSL termination, request/response transformation, caching, load balancing, and observability (request tracing). Examples: Spring Cloud Gateway, AWS API Gateway, Kong, Nginx. It decouples clients from backend topology changes and enforces cross-cutting concerns in one place.' },
      { id: 'java-entry-7', level: 'entry', text: 'What are Java Generics and give an example of where they help?', referenceAnswer: 'Generics allow classes and methods to operate on typed parameters, enabling type-safe collections without casting. Example: List<String> guarantees the list contains only Strings — the compiler catches type errors at compile time rather than runtime ClassCastExceptions. Bounded wildcards (List<? extends Number>) enable covariance. Generics are erased at runtime (type erasure), so runtime type checks on generic types require extra care.' },
      { id: 'java-entry-8', level: 'entry', text: 'What is a Docker container and how does it differ from a virtual machine?', referenceAnswer: 'A container shares the host OS kernel and runs as an isolated process (via Linux namespaces and cgroups), making it lightweight and fast to start (seconds vs. minutes). A VM includes a full guest OS on top of a hypervisor, giving stronger isolation but at higher resource cost. Containers are ideal for packaging microservices; VMs are preferred for multi-tenant isolation or running different OS kernels.' },
      { id: 'java-intermediate-1', level: 'intermediate', text: 'How would you design a Spring Boot microservice to handle 10,000 concurrent requests? What configuration and architectural choices matter?', referenceAnswer: 'Use a non-blocking I/O stack (Spring WebFlux + Netty) or, for blocking JDBC, tune the thread pool size to match expected concurrency. Enable connection pooling (HikariCP tuned to DB capacity), cache hot data (Redis/Caffeine), and deploy multiple instances behind a load balancer. Profile with a load test (Gatling, k6) before tuning to identify the real bottleneck — it is usually the database, not the application.' },
      { id: 'java-intermediate-2', level: 'intermediate', text: 'What is the Circuit Breaker pattern and how would you implement it with Resilience4j in Spring Boot?', referenceAnswer: 'A circuit breaker wraps remote calls and transitions between states: CLOSED (calls pass through), OPEN (calls fail-fast without attempting, preventing cascading failures), and HALF-OPEN (a probe call tests whether the remote service has recovered). Resilience4j\'s @CircuitBreaker annotation with a fallback method implements this declaratively; configure failure rate threshold, wait duration in open state, and permitted calls in half-open.' },
      { id: 'java-intermediate-3', level: 'intermediate', text: 'Explain optimistic vs pessimistic locking in JPA. When would you use each?', referenceAnswer: 'Optimistic locking adds a @Version column; the UPDATE fails (OptimisticLockException) if another transaction modified the row between read and write — suitable for low-contention scenarios where conflicts are rare. Pessimistic locking issues a SELECT FOR UPDATE, blocking other transactions — suitable for high-contention scenarios where lost updates are unacceptable. Optimistic is preferred for scalability; pessimistic when correctness under high contention is paramount.' },
      { id: 'java-intermediate-4', level: 'intermediate', text: 'How does Apache Kafka enable asynchronous communication between microservices? Describe a concrete use case.', referenceAnswer: 'Kafka is a distributed log: producers append events to a topic (partitioned for parallelism); consumers read at their own pace with durable offset tracking. This decouples producer throughput from consumer processing speed and enables replay. Example: an order-placed event is published by the Order service; Inventory, Payment, and Notification services each consume it independently, scaling and failing without affecting each other.' },
      { id: 'java-intermediate-5', level: 'intermediate', text: 'How would you implement distributed tracing across multiple Spring Boot microservices?', referenceAnswer: 'Add Spring Cloud Sleuth (or Micrometer Tracing in Spring Boot 3) which auto-instruments HTTP clients, Kafka producers/consumers, and database calls with W3C Trace Context headers (traceId, spanId). Spans are exported to a tracing backend (Zipkin, Jaeger, AWS X-Ray) where the full request journey across services is visible as a trace. Use the trace ID in logs (MDC) for correlation.' },
      { id: 'java-intermediate-6', level: 'intermediate', text: 'What is Spring Cloud Config and how does it centralise configuration for microservices?', referenceAnswer: 'Spring Cloud Config Server serves configuration properties from a git repository (or Vault, S3) to all microservices at startup and optionally at runtime via @RefreshScope. This means all environment-specific configuration (database URLs, feature flags, API keys) is stored in one place, version-controlled, auditable, and can be updated without redeploying services. Each service fetches its config using application name and environment as keys.' },
      { id: 'java-intermediate-7', level: 'intermediate', text: 'How do you secure a Spring Boot REST API beyond basic authentication?', referenceAnswer: 'Prefer OAuth2/OIDC with JWT tokens — the client gets a signed token from an identity provider (Keycloak, Auth0, Okta); the API validates the token\'s signature and claims without a DB roundtrip. Add: HTTPS enforcement, CSRF protection (for browser clients), rate limiting (Bucket4j, API Gateway), input validation (@Valid), and CORS policy. Use spring-security-oauth2-resource-server for JWT validation with one dependency.' },
      { id: 'java-intermediate-8', level: 'intermediate', text: 'What is the difference between horizontal and vertical scaling? When would you choose each in a cloud environment?', referenceAnswer: 'Vertical scaling adds more CPU/RAM to an existing instance — simple but has a ceiling and causes downtime. Horizontal scaling adds more instances behind a load balancer — no ceiling and can be automated (auto-scaling groups), but requires the application to be stateless or use shared state (Redis, DB). For cloud microservices, always design for horizontal scaling from the start; use vertical scaling only for databases or legacy components that cannot distribute.' },
      { id: 'java-advanced-1', level: 'advanced', text: 'Describe the strangler fig pattern and how you would apply it to migrate a Java monolith to microservices.', referenceAnswer: 'The strangler fig pattern incrementally replaces monolith functionality by routing specific paths to new microservices (via an API gateway or reverse proxy), leaving the rest to the monolith. The monolith "strangles" over time. Implementation: extract one bounded context (e.g. user profile), deploy it as a microservice, configure routing, test, then continue with the next context. This avoids big-bang rewrites and allows validation at each step.' },
      { id: 'java-advanced-2', level: 'advanced', text: 'Describe the Saga pattern for handling distributed transactions across microservices.', referenceAnswer: 'A saga is a sequence of local transactions, one per service, coordinated by either choreography (each service publishes events that trigger the next service) or orchestration (a central saga orchestrator calls each service). If a step fails, compensating transactions are executed in reverse order to roll back. Example: Order → Reserve Inventory → Charge Payment → Ship; if Charge fails, Release Inventory runs.' },
      { id: 'java-advanced-3', level: 'advanced', text: 'How would you approach JVM tuning and investigating a memory leak in a production Spring Boot application?', referenceAnswer: 'Enable GC logging (-Xlog:gc*) and Spring Boot Actuator /actuator/metrics for heap metrics. If heap grows continuously, take heap dumps (jcmd <pid> GC.heap_dump) and analyse with Eclipse MAT or YourKit to find the dominator object. Common causes: caches without eviction, listeners never deregistered, ThreadLocal pollution. Tune heap size (-Xmx) only after finding the root cause — leaks can\'t be tuned away.' },
      { id: 'java-advanced-4', level: 'advanced', text: 'How would you design a highly available Spring Boot service with 99.99% uptime requirements?', referenceAnswer: 'Multi-instance deployment across multiple AZs behind a load balancer with health checks. Zero-downtime deployments (rolling, blue-green, or canary). Database: primary-replica with automatic failover (RDS Multi-AZ) or a distributed DB. Circuit breakers + retries with backoff for all external calls. Graceful shutdown (spring.lifecycle.timeout-per-shutdown-phase). Runbooks for every alert. Chaos engineering to validate resilience. Target error budget: 52 minutes downtime/year.' },
      { id: 'java-advanced-5', level: 'advanced', text: 'How do you handle database schema migrations in a zero-downtime deployment of a Spring Boot service?', referenceAnswer: 'Use Flyway or Liquibase for versioned, repeatable migrations. Zero-downtime constraint: migrations must be backwards-compatible — new columns must be nullable or have a default, old columns can only be dropped after all instances of the old code are gone (multi-step: add column, deploy new code, remove column). Never rename columns directly; add the new name and remove the old in a subsequent deployment.' },
      { id: 'java-advanced-6', level: 'advanced', text: 'What are key design decisions for a multi-tenant SaaS application built with Spring Boot?', referenceAnswer: 'Tenancy model: shared database with tenant_id column (lowest cost, harder isolation), schema-per-tenant (good isolation, moderate cost), or database-per-tenant (strongest isolation, highest cost). Spring\'s @TenantId or AbstractRoutingDataSource enable schema/database routing. Isolation: row-level security in PostgreSQL adds a DB-layer safety net. Rate limiting and resource quotas per tenant prevent noisy-neighbour problems. Auth: JWT claims carry the tenant ID.' },
      { id: 'java-advanced-7', level: 'advanced', text: 'How would you optimise the performance of a JPA-heavy Spring Boot application under high load?', referenceAnswer: 'Enable SQL query logging first to understand actual DB calls. Common fixes: use projections (interfaces or DTOs) instead of full entity fetching, fix N+1 queries with JOIN FETCH or @BatchSize, add DB indexes on join/filter columns, use second-level cache (Ehcache/Redis) for read-heavy entities, reduce transaction scope, and switch to native queries or jOOQ for complex analytical queries that Hibernate generates poorly.' },
      { id: 'java-advanced-8', level: 'advanced', text: 'Describe the key architectural decisions for running Spring Boot microservices on Kubernetes at scale.', referenceAnswer: 'Stateless pods with configuration via ConfigMaps/Secrets. Resource requests and limits calibrated from profiling. Readiness and liveness probes for proper traffic routing and restart policy. Horizontal Pod Autoscaler on CPU or custom metrics. PodDisruptionBudgets for safe rolling updates. Service mesh (Istio/Linkerd) for mTLS, traffic management, and observability. Persistent volumes only for stateful services (databases), not application pods. Separate namespaces per environment with RBAC.' },
      { id: 'java-expert-1', level: 'expert', text: 'How would you architect a cloud-native platform for a financial services company with strict compliance requirements (PCI-DSS, SOC 2)?', referenceAnswer: 'VPC with private subnets for all compute; no public internet access for data-handling services. All data at rest encrypted (KMS). TLS 1.2+ for all inter-service and external communication. Immutable infrastructure (no SSH, changes only through CI/CD). Network segmentation and WAF for public endpoints. Centralised secrets management (Vault/AWS Secrets Manager). Audit logging for all API calls (CloudTrail). Automated compliance evidence collection. Penetration testing schedule. Separate non-prod environments with data masking.' },
      { id: 'java-expert-2', level: 'expert', text: 'Describe your strategy for building a service mesh for an organisation with 200+ microservices.', referenceAnswer: 'Roll out Istio or Linkerd incrementally by namespace, starting with highest-traffic services. mTLS between all services for zero-trust security. Traffic management: canary splits via VirtualService, circuit breakers in DestinationRule. Observability: auto-injected metrics and distributed traces without code changes. Start with observability and mTLS as the two highest-value features before adding complex traffic management. Invest in a mesh control-plane team to manage upgrades and policies centrally.' },
      { id: 'java-expert-3', level: 'expert', text: 'What is your approach to disaster recovery and business continuity for a multi-region, cloud-based Java application?', referenceAnswer: 'Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective) first — they drive cost. Active-active multi-region: traffic routes to healthy regions automatically, data replicated synchronously (higher cost, near-zero RPO). Active-passive: primary region handles traffic, secondary on warm standby, promoted on failover (RTO minutes, RPO seconds depending on DB replication lag). Regularly test DR via game days. For a Java app, the DB is usually the hardest part — globalised managed DBs (Aurora Global DB, Spanner) simplify this.' },
      { id: 'java-expert-4', level: 'expert', text: 'How do you design a rate limiting and quota management system for a public API built with Spring Boot?', referenceAnswer: 'Token-bucket or sliding window algorithm, implemented at the API Gateway layer (first line of defence) and optionally in the application (for fine-grained per-operation limits). Shared state in Redis for consistent limits across instances. Identify clients by API key or OAuth client_id. Return 429 Too Many Requests with Retry-After header. Separate quotas per tier (free/paid). Async quota update (don\'t hit Redis on every single request — use a local counter synced to Redis periodically for very high throughput).' },
      { id: 'java-expert-5', level: 'expert', text: 'How do you think about the future of Java in the cloud-native era — GraalVM native images, Project Loom, and what trade-offs they offer?', referenceAnswer: 'GraalVM Native Image compiles Java to a native binary: sub-second startup and low memory — ideal for serverless and sidecar microservices, but requires reflection/dynamic class loading configuration and longer build times. Project Loom (virtual threads, GA in JDK 21) brings massive concurrency to blocking-style code without reactive complexity — a large quality-of-life improvement for Spring Boot apps. The direction is: native for serverless, virtual threads for long-running services. Both reduce the performance argument for Go/Rust on the JVM\'s traditional use-cases.' },
      { id: 'java-expert-6', level: 'expert', text: 'Describe a complex distributed systems problem you have solved involving Java microservices. What was the failure mode and your solution?', referenceAnswer: 'Look for: a real scenario with non-trivial causality (not just "a service went down"), structured debugging approach (distributed traces, metrics, log correlation), root cause analysis (timing issue, partial failure, data inconsistency), solution that changed the architecture or process, and a post-mortem. Strong signals: the candidate can describe the exact timeline of failure, what data led them to the root cause, and what prevented the same failure class in the future.' },
      { id: 'java-expert-7', level: 'expert', text: 'Describe how you would build an internal developer platform (IDP) that makes deploying Spring Boot microservices to Kubernetes self-service for 50+ teams.', referenceAnswer: 'Golden path templates: a curated Spring Boot + Kubernetes starter that embeds best practices (health probes, structured logging, Prometheus metrics, Dockerised build). Self-service provisioning portal: new service scaffold via Backstage or a CLI, automatically creates a GitHub repo, CI pipeline, ArgoCD application, and monitoring dashboard. Platform team owns the template; product teams own their services. Key success metric: time from "new service idea" to "first production deploy" should be hours, not weeks.' },
      { id: 'java-expert-8', level: 'expert', text: 'How would you approach cost optimisation for a large-scale cloud deployment of Java microservices while maintaining performance and reliability?', referenceAnswer: 'Rightsizing: continuously profile resource usage and set requests/limits tightly (stop over-provisioning). Spot/preemptible instances for stateless workloads with graceful shutdown. Committed use discounts for baseline steady-state compute. Autoscaling: scale down aggressively in off-peak (KEDA on queue depth). Cache to reduce DB calls (elasticache hit-rate). Consolidate low-traffic services on fewer pods (avoid 50 services each with a minimum of 2 replicas). Monitor cost per service per request, not just total bill.' },
    ],
  },
];

/* ==========================================================================
   Pure utility helpers
   ========================================================================== */

const MAX_TECHNICAL_PER_INTERVIEW = 6;
const MAX_BEHAVIORAL_PER_INTERVIEW = 3;

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

function buildInterview({ candidateName, interviewer, date, notes, domainId, domainName, level, questions }) {
  const responses = (questions || []).map((q) => ({
    questionId: q.id,
    questionText: q.text,
    referenceAnswer: q.referenceAnswer || '',
    response: '',
    rating: null,
  }));

  return {
    id: generateId(),
    candidateName,
    domainId,
    domainName,
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

async function generateReferenceAnswerWithAI(questionText, apiKey) {
  if (!apiKey) throw new Error('No API key configured.');
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
      max_tokens: 350,
      system:
        'You are a senior technical interviewer. Given an interview question, write a concise reference answer (2–4 sentences) describing what a strong candidate should cover. Be specific and accurate. Plain prose only — no markdown, no bullets.',
      messages: [{ role: 'user', content: `Interview question: ${questionText.trim()}` }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `API error (${res.status})`);
  }
  const data = await res.json();
  const text = (data.content || []).find((b) => b.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty response.');
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

function NewInterviewView({ domains, defaultInterviewer, apiKey, onGenerateAnswer, onCreate, onCancel }) {
  const technicalDomains = useMemo(() => domains.filter((d) => d.id !== BEHAVIORAL_DOMAIN_ID), [domains]);
  const behavioralDomain = useMemo(() => domains.find((d) => d.id === BEHAVIORAL_DOMAIN_ID), [domains]);

  /* ── Step 1 state ── */
  const [step, setStep] = useState(1);
  const [candidateName, setCandidateName] = useState('');
  const [selectedDomainIds, setSelectedDomainIds] = useState(() => new Set([technicalDomains[0]?.id].filter(Boolean)));
  const [level, setLevel] = useState(LEVELS[1]?.id || LEVELS[0]?.id || '');
  const [interviewer, setInterviewer] = useState(defaultInterviewer || '');
  const [date, setDate] = useState(todayInputDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  /* ── Step 2 state ── */
  const [plannedQuestions, setPlannedQuestions] = useState([]);
  const [activeForm, setActiveForm] = useState(null); // null | { type:'swap', idx } | { type:'add' }
  const [formText, setFormText] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formGenerating, setFormGenerating] = useState(false);
  const debounceRef = useRef(null);
  const [pullDomainId, setPullDomainId] = useState('');
  const [pullCount, setPullCount] = useState(3);
  const [pullMsg, setPullMsg] = useState('');

  function toggleDomain(id) {
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /* Step 1 → Step 2: build randomised list distributed across selected domains */
  function handleGoToStep2(event) {
    event.preventDefault();
    if (!candidateName.trim()) { setError('Candidate name is required.'); return; }
    if (selectedDomainIds.size === 0) { setError('Select at least one domain.'); return; }

    const perDomain = Math.max(2, Math.ceil(MAX_TECHNICAL_PER_INTERVIEW / selectedDomainIds.size));
    const techQuestions = [];
    for (const domId of selectedDomainIds) {
      const dom = technicalDomains.find((d) => d.id === domId);
      if (!dom) continue;
      const pool = dom.questions.filter((q) => q.level === level);
      shuffleArray(pool).slice(0, perDomain).forEach((q) =>
        techQuestions.push({ ...q, _section: 'technical', _domainId: dom.id, _domainName: dom.name })
      );
    }
    const behPool = (behavioralDomain?.questions || []).filter((q) => q.level === level);
    const behQuestions = shuffleArray(behPool).slice(0, MAX_BEHAVIORAL_PER_INTERVIEW).map((q) => ({
      ...q, _section: 'behavioral', _domainId: BEHAVIORAL_DOMAIN_ID, _domainName: 'Behavioral & SDLC',
    }));

    if (techQuestions.length === 0 && behQuestions.length === 0) {
      setError(`No questions found at the ${LEVEL_LABELS[level]} level for the selected domains.`);
      return;
    }

    setPullDomainId([...selectedDomainIds][0] || '');
    setPullMsg('');
    setPlannedQuestions([...techQuestions, ...behQuestions]);
    setActiveForm(null);
    setFormText('');
    setFormRef('');
    setError('');
    setStep(2);
  }

  /* Debounced AI reference answer */
  function handleFormTextChange(text) {
    setFormText(text);
    setFormRef('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length > 20 && apiKey && onGenerateAnswer) {
      debounceRef.current = setTimeout(async () => {
        setFormGenerating(true);
        try { const a = await onGenerateAnswer(text); if (a) setFormRef(a); } catch {}
        setFormGenerating(false);
      }, 1500);
    }
  }

  function openSwapForm(idx) { setActiveForm({ type: 'swap', idx }); setFormText(''); setFormRef(''); setFormGenerating(false); }
  function openAddForm()     { setActiveForm({ type: 'add' }); setFormText(''); setFormRef(''); setFormGenerating(false); }
  function closeForm() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActiveForm(null); setFormText(''); setFormRef(''); setFormGenerating(false);
  }

  function handleConfirmForm() {
    if (!formText.trim()) return;
    const swappedQ = activeForm.type === 'swap' ? plannedQuestions[activeForm.idx] : null;
    const customQ = {
      id: `custom-${generateId()}`,
      text: formText.trim(),
      referenceAnswer: formRef.trim(),
      level,
      isCustom: true,
      _section: swappedQ?._section || 'technical',
      _domainId: swappedQ?._domainId || [...selectedDomainIds][0] || '',
      _domainName: swappedQ?._domainName || technicalDomains.find((d) => d.id === [...selectedDomainIds][0])?.name || '',
    };
    if (activeForm.type === 'swap') {
      setPlannedQuestions((prev) => prev.map((q, i) => (i === activeForm.idx ? customQ : q)));
    } else {
      setPlannedQuestions((prev) => [...prev, customQ]);
    }
    closeForm();
  }

  function handleDiscardQuestion(idx) {
    if (activeForm?.type === 'swap' && activeForm.idx === idx) closeForm();
    setPlannedQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  /* Pull unused questions from any domain at the same level */
  function handlePullMore() {
    if (!pullDomainId) return;
    const existingIds = new Set(plannedQuestions.map((q) => q.id));
    const isBeh = pullDomainId === BEHAVIORAL_DOMAIN_ID;
    const srcDomain = isBeh ? behavioralDomain : domains.find((d) => d.id === pullDomainId);
    if (!srcDomain) return;
    const pool = (srcDomain.questions || []).filter((q) => q.level === level && !existingIds.has(q.id));
    const toAdd = shuffleArray(pool).slice(0, pullCount);
    if (toAdd.length === 0) {
      setPullMsg(`No more unused questions at ${LEVEL_LABELS[level]} level in ${isBeh ? 'Behavioral & SDLC' : srcDomain.name}.`);
      return;
    }
    setPlannedQuestions((prev) => [
      ...prev,
      ...toAdd.map((q) => ({
        ...q,
        _section: isBeh ? 'behavioral' : 'technical',
        _domainId: srcDomain.id,
        _domainName: isBeh ? 'Behavioral & SDLC' : srcDomain.name,
      })),
    ]);
    setPullMsg(`Added ${toAdd.length} question${toAdd.length === 1 ? '' : 's'} from ${isBeh ? 'Behavioral & SDLC' : srcDomain.name}.`);
  }

  function handleStartInterview() {
    const finalQs = plannedQuestions.filter((q) => q.text?.trim());
    if (finalQs.length === 0) { setError('No questions selected — add at least one.'); return; }
    const customQuestions = finalQs.filter((q) => q.isCustom);
    const domainNames = [...selectedDomainIds].map((id) => technicalDomains.find((d) => d.id === id)?.name).filter(Boolean);
    onCreate({
      candidateName: candidateName.trim(),
      domainId: [...selectedDomainIds][0] || 'multi',
      domainName: domainNames.join(' + ') || 'Mixed',
      level,
      interviewer: interviewer.trim(),
      date,
      notes: notes.trim(),
      questions: finalQs,
      customQuestions,
    });
  }

  /* Inline question row (called as function, not <Component>, to avoid remount-per-render) */
  function renderQuestionRow(q, globalIdx) {
    const isSwapping = activeForm?.type === 'swap' && activeForm.idx === globalIdx;
    return (
      <div className="ip-question-card" key={q.id}>
        <div className="ip-question-card-compact">
          <p className="ip-question-text" style={{ flex: 1 }}>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>{globalIdx + 1}.</span>
            {q.text || <em className="ip-text-muted">Custom question</em>}
            {q.isCustom && <Badge tone="warning">Custom</Badge>}
          </p>
          <div className="ip-table-actions">
            <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => openSwapForm(globalIdx)}>Swap ↔</button>
            <button type="button" className="ip-btn ip-btn-sm ip-btn-danger" onClick={() => handleDiscardQuestion(globalIdx)}>Discard</button>
          </div>
        </div>
        {isSwapping && (
          <div className="ip-swap-form">
            <p className="ip-small" style={{ marginBottom: 8 }}>Replace question {globalIdx + 1} with a custom question (also saved to question bank):</p>
            <div className="ip-field">
              <label>Your Question</label>
              <textarea rows={2} value={formText} onChange={(e) => handleFormTextChange(e.target.value)} placeholder="Type your question here..." autoFocus />
            </div>
            <div className="ip-field">
              <label>
                Reference Answer{' '}
                {formGenerating ? <span className="ip-text-muted ip-small">(generating...)</span>
                  : apiKey ? <span className="ip-text-muted ip-small">(auto-generating as you type)</span>
                  : <span className="ip-text-muted ip-small">(set API key in Settings to auto-generate)</span>}
              </label>
              <textarea rows={2} value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="What should a strong answer cover? (optional)" />
            </div>
            <div className="ip-form-actions ip-form-actions-start">
              <button type="button" className="ip-btn ip-btn-ghost ip-btn-sm" onClick={closeForm}>Cancel</button>
              <button type="button" className="ip-btn ip-btn-primary ip-btn-sm" onClick={handleConfirmForm} disabled={!formText.trim()}>Use this question</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Step 1 render ── */
  if (step === 1) {
    const perDomainPreview = selectedDomainIds.size > 0
      ? Math.max(2, Math.ceil(MAX_TECHNICAL_PER_INTERVIEW / selectedDomainIds.size))
      : MAX_TECHNICAL_PER_INTERVIEW;

    return (
      <div>
        <div className="ip-page-header">
          <div>
            <h1>New Interview</h1>
            <p className="ip-text-muted">Step 1 of 2 — Candidate details &amp; domain selection</p>
          </div>
        </div>
        <div className="ip-card ip-card-narrow">
          <form onSubmit={handleGoToStep2} noValidate>
            <div className="ip-field">
              <label htmlFor="ni-candidate">Candidate Name *</label>
              <input id="ni-candidate" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="e.g. Priya Sharma" autoFocus />
            </div>
            <div className="ip-field">
              <label htmlFor="ni-level">Candidate Level *</label>
              <select id="ni-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div className="ip-field">
              <label>Technical Domains *</label>
              <p className="ip-small ip-text-muted" style={{ marginBottom: 8 }}>
                Tick one or more — questions will be mixed from each selected domain at the chosen level.
                Behavioral &amp; SDLC is always included automatically.
              </p>
              <div className="ip-domain-checklist">
                {technicalDomains.map((d) => {
                  const count = d.questions.filter((q) => q.level === level).length;
                  return (
                    <label key={d.id} className="ip-domain-check-item">
                      <input type="checkbox" checked={selectedDomainIds.has(d.id)} onChange={() => toggleDomain(d.id)} />
                      <span className="ip-domain-check-name">{d.name}</span>
                      <span className="ip-text-muted ip-small">({count} questions at this level)</span>
                    </label>
                  );
                })}
              </div>
              {selectedDomainIds.size > 0 && (
                <p className="ip-small ip-text-muted" style={{ marginTop: 8 }}>
                  Auto-selects ≈{perDomainPreview} questions per domain + {MAX_BEHAVIORAL_PER_INTERVIEW} behavioral.
                  You can add, swap, or discard individual questions in Step 2.
                </p>
              )}
            </div>
            <div className="ip-field">
              <label htmlFor="ni-interviewer">Interviewer</label>
              <input id="ni-interviewer" value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder="Your name" />
            </div>
            <div className="ip-field">
              <label htmlFor="ni-date">Date</label>
              <input id="ni-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="ip-field">
              <label htmlFor="ni-notes">Notes (optional)</label>
              <textarea id="ni-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context about this candidate or role..." />
            </div>
            {error && <p className="ip-form-error">{error}</p>}
            <div className="ip-form-actions">
              <button type="button" className="ip-btn ip-btn-ghost" onClick={onCancel}>Cancel</button>
              <button type="submit" className="ip-btn ip-btn-primary" disabled={selectedDomainIds.size === 0}>Review Questions →</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ── Step 2 render ── */
  // Group questions by domain in first-seen order
  const seenDomIds = [];
  plannedQuestions.forEach((q) => { if (!seenDomIds.includes(q._domainId)) seenDomIds.push(q._domainId); });
  const domainGroups = seenDomIds.map((domId) => {
    const qs = plannedQuestions.filter((q) => q._domainId === domId);
    return { domainId: domId, domainName: qs[0]?._domainName || domId, questions: qs };
  });

  const allDomainsForPull = [
    ...technicalDomains,
    ...(behavioralDomain ? [{ ...behavioralDomain, name: 'Behavioral & SDLC' }] : []),
  ];

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Review Questions — {candidateName}</h1>
          <p className="ip-text-muted">
            Step 2 of 2 · {LEVEL_LABELS[level]} · {plannedQuestions.length} question{plannedQuestions.length === 1 ? '' : 's'} total
          </p>
        </div>
      </div>

      {domainGroups.map(({ domainId: gDomId, domainName: gDomName, questions: gQs }) => (
        <div className="ip-card" key={gDomId}>
          <h3>
            {gDomName}
            <span className="ip-text-muted" style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: 8 }}>({gQs.length})</span>
          </h3>
          {gQs.map((q) => renderQuestionRow(q, plannedQuestions.indexOf(q)))}
        </div>
      ))}

      {/* Pull more questions from question bank */}
      <div className="ip-card ip-pull-more-card">
        <h3>Pull More Questions</h3>
        <p className="ip-small ip-text-muted" style={{ marginBottom: 12 }}>
          Add more questions from any domain at the <strong>{LEVEL_LABELS[level]}</strong> level. Already-selected questions are excluded automatically.
        </p>
        <div className="ip-pull-more-row">
          <div style={{ flex: 2, minWidth: 0 }}>
            <div className="ip-pull-label">Domain</div>
            <select
              className="ip-pull-select"
              value={pullDomainId}
              onChange={(e) => { setPullDomainId(e.target.value); setPullMsg(''); }}
            >
              {allDomainsForPull.map((d) => {
                const unused = (d.questions || []).filter((q) => q.level === level && !plannedQuestions.find((p) => p.id === q.id)).length;
                return <option key={d.id} value={d.id}>{d.name} ({unused} unused)</option>;
              })}
            </select>
          </div>
          <div style={{ flex: '0 0 90px' }}>
            <div className="ip-pull-label">Count</div>
            <select className="ip-pull-select" value={pullCount} onChange={(e) => { setPullCount(Number(e.target.value)); setPullMsg(''); }}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button type="button" className="ip-btn ip-btn-secondary ip-pull-btn" onClick={handlePullMore}>
            + Add
          </button>
        </div>
        {pullMsg && (
          <p className="ip-small" style={{ marginTop: 6, color: pullMsg.startsWith('No more') ? '#b45309' : '#15803d' }}>
            {pullMsg}
          </p>
        )}
      </div>

      {/* Write a custom question */}
      {activeForm?.type === 'add' ? (
        <div className="ip-card">
          <h3>Write a Custom Question</h3>
          <div className="ip-field">
            <label>Your Question</label>
            <textarea rows={2} value={formText} onChange={(e) => handleFormTextChange(e.target.value)} placeholder="Type your question here..." autoFocus />
          </div>
          <div className="ip-field">
            <label>
              Reference Answer{' '}
              {formGenerating ? <span className="ip-text-muted ip-small">(generating...)</span>
                : apiKey ? <span className="ip-text-muted ip-small">(auto-generating as you type)</span> : null}
            </label>
            <textarea rows={2} value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="What should a strong answer cover? (optional)" />
          </div>
          <p className="ip-small ip-text-muted" style={{ marginBottom: 8 }}>This question will also be saved to the question bank.</p>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="button" className="ip-btn ip-btn-ghost ip-btn-sm" onClick={closeForm}>Cancel</button>
            <button type="button" className="ip-btn ip-btn-primary ip-btn-sm" onClick={handleConfirmForm} disabled={!formText.trim()}>Add to Interview</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <button type="button" className="ip-btn ip-btn-secondary" onClick={openAddForm}>+ Write a Custom Question</button>
        </div>
      )}

      {error && <p className="ip-form-error">{error}</p>}

      <div className="ip-form-actions">
        <button type="button" className="ip-btn ip-btn-ghost" onClick={() => { setStep(1); setError(''); setPullMsg(''); }}>← Back to Details</button>
        <button type="button" className="ip-btn ip-btn-primary" onClick={handleStartInterview}>
          Start Interview ({plannedQuestions.length} questions) →
        </button>
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

function QuestionBankView({ domains, onAddQuestion, onDeleteQuestion, onGenerateAnswer }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id || '');
  const [newQuestion, setNewQuestion] = useState('');
  const [newLevel, setNewLevel] = useState(LEVELS[1]?.id || LEVELS[0]?.id || '');
  const [newReferenceAnswer, setNewReferenceAnswer] = useState('');
  const [levelFilter, setLevelFilter] = useState(LEVELS[1]?.id || LEVELS[0]?.id || '');
  const [isGeneratingRef, setIsGeneratingRef] = useState(false);
  const qbDebounceRef = useRef(null);

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) || domains[0];
  const visibleQuestions = selectedDomain
    ? selectedDomain.questions.filter((q) => levelFilter === 'all' || q.level === levelFilter)
    : [];

  function handleQuestionTextChange(text) {
    setNewQuestion(text);
    setNewReferenceAnswer('');
    if (qbDebounceRef.current) clearTimeout(qbDebounceRef.current);
    if (text.trim().length > 20 && onGenerateAnswer) {
      qbDebounceRef.current = setTimeout(async () => {
        setIsGeneratingRef(true);
        try {
          const answer = await onGenerateAnswer(text);
          if (answer) setNewReferenceAnswer(answer);
        } catch {}
        setIsGeneratingRef(false);
      }, 1500);
    }
  }

  async function handleGenerateRefManual() {
    if (!newQuestion.trim() || !onGenerateAnswer) return;
    setIsGeneratingRef(true);
    try {
      const answer = await onGenerateAnswer(newQuestion);
      if (answer) setNewReferenceAnswer(answer);
    } catch {}
    setIsGeneratingRef(false);
  }

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
        <h3>Add a Question to {selectedDomain.name}</h3>
        <form onSubmit={handleAdd}>
          <div className="ip-field ip-field-inline">
            <label htmlFor="qb-level">Level</label>
            <select id="qb-level" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="qb-text">Question</label>
            <textarea
              id="qb-text"
              rows={2}
              value={newQuestion}
              onChange={(e) => handleQuestionTextChange(e.target.value)}
              placeholder={`New question for ${selectedDomain.name}...`}
            />
          </div>
          <div className="ip-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="qb-reference" style={{ margin: 0 }}>
                Reference Answer
                {isGeneratingRef && <span className="ip-text-muted ip-small"> (generating...)</span>}
              </label>
              {onGenerateAnswer && (
                <button
                  type="button"
                  className="ip-btn ip-btn-sm ip-btn-secondary"
                  onClick={handleGenerateRefManual}
                  disabled={isGeneratingRef || !newQuestion.trim()}
                >
                  {isGeneratingRef ? 'Generating...' : '⚡ Generate with AI'}
                </button>
              )}
            </div>
            <textarea
              id="qb-reference"
              rows={2}
              value={newReferenceAnswer}
              onChange={(e) => setNewReferenceAnswer(e.target.value)}
              placeholder="What should a strong answer cover? (auto-generated when you type a question)"
            />
          </div>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="submit" className="ip-btn ip-btn-primary" disabled={!newQuestion.trim()}>
              Add Question
            </button>
          </div>
        </form>
      </div>

      <div className="ip-card">
        <div className="ip-page-header">
          <h3>{selectedDomain.name} Questions ({visibleQuestions.length} shown)</h3>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="ip-level-filter">
            <option value="all">All levels ({selectedDomain.questions.length})</option>
            {LEVELS.map((l) => {
              const cnt = selectedDomain.questions.filter((q) => q.level === l.id).length;
              return (
                <option key={l.id} value={l.id}>{l.label} ({cnt})</option>
              );
            })}
          </select>
        </div>
        {visibleQuestions.length === 0 ? (
          <EmptyState title="No questions at this level" body="Add one above, or choose a different level." />
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
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) return DEFAULT_DOMAINS;
    // Merge: add new default domains and new questions within existing domains
    const loadedMap = new Map(loaded.map((d) => [d.id, d]));
    const merged = DEFAULT_DOMAINS.map((defaultDomain) => {
      const existing = loadedMap.get(defaultDomain.id);
      if (!existing) return defaultDomain;
      const existingQIds = new Set(existing.questions.map((q) => q.id));
      const newQs = defaultDomain.questions.filter((q) => !existingQIds.has(q.id));
      return { ...existing, questions: [...existing.questions, ...newQs] };
    });
    const defaultIds = new Set(DEFAULT_DOMAINS.map((d) => d.id));
    const userDomains = loaded.filter((d) => !defaultIds.has(d.id));
    return [...merged, ...userDomains];
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
    ({ candidateName, domainId, domainName, level, interviewer, date, notes, questions, customQuestions }) => {
      // Auto-save custom questions into their respective domain question banks
      if (customQuestions?.length > 0) {
        setDomains((prev) =>
          prev.map((d) => {
            const domCustomQs = customQuestions.filter((q) => (q._domainId || domainId) === d.id);
            if (domCustomQs.length === 0) return d;
            const existingIds = new Set(d.questions.map((q) => q.id));
            const newQs = domCustomQs
              .filter((q) => !existingIds.has(q.id))
              .map(({ id, text, referenceAnswer, level: ql }) => ({ id, text, referenceAnswer, level: ql }));
            return newQs.length > 0 ? { ...d, questions: [...d.questions, ...newQs] } : d;
          })
        );
      }
      const interview = buildInterview({ candidateName, interviewer, date, notes, domainId, domainName, level, questions });
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

  const handleGenerateReferenceAnswer = useCallback(
    async (questionText) => {
      if (!questionText?.trim()) return null;
      try {
        return await generateReferenceAnswerWithAI(questionText, settings.anthropicApiKey);
      } catch {
        return null;
      }
    },
    [settings.anthropicApiKey]
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
          apiKey={settings.anthropicApiKey}
          onGenerateAnswer={handleGenerateReferenceAnswer}
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
        <QuestionBankView
          domains={domains}
          onAddQuestion={handleAddQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onGenerateAnswer={handleGenerateReferenceAnswer}
        />
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
.ip-domain-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ip-domain-check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}
.ip-domain-check-item:hover {
  background: #f0f4ff;
}
.ip-domain-check-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
}
.ip-domain-check-name {
  flex: 1;
  font-weight: 500;
}
.ip-pull-more-card {
  border: 1px solid var(--color-primary-light);
  background: #f7f9ff;
}
.ip-pull-more-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.ip-pull-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}
.ip-pull-select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  background: #fff;
  font-size: 0.9rem;
}
.ip-pull-btn {
  flex-shrink: 0;
  margin-bottom: 1px;
}
.ip-swap-form {
  margin-top: 12px;
  padding: 14px 16px;
  background: #fafaff;
  border: 1px dashed var(--color-primary-light);
  border-radius: var(--radius-md);
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
