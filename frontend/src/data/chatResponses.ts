const YOGA_RESPONSES: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['benefit', 'why yoga', 'good for', 'advantages', 'helps'],
    response:
      'Yoga offers incredible benefits! It improves flexibility, builds strength, enhances balance, reduces stress, and promotes mindfulness. Regular practice can also help with better sleep, improved posture, and increased energy levels. 🧘‍♀️',
  },
  {
    keywords: ['breath', 'breathing', 'pranayama', 'inhale', 'exhale'],
    response:
      'Breathing is the foundation of yoga! The basic technique is Ujjayi breathing: inhale slowly through your nose for 4 counts, then exhale through your nose for 4 counts, creating a gentle ocean-like sound. Always coordinate your breath with movement — inhale to expand, exhale to fold or twist. 🌬️',
  },
  {
    keywords: ['warm up', 'warmup', 'before', 'prepare'],
    response:
      'Great question! Before any yoga session, try these warm-ups: gentle neck rolls, shoulder circles, cat-cow stretches, and easy standing side bends. This helps prepare your muscles and joints for deeper poses. Never skip warming up! 🔥',
  },
  {
    keywords: ['flexible', 'flexibility', 'stiff', 'tight', "can't touch"],
    response:
      "Flexibility comes with practice — you don't need to be flexible to start yoga! Begin where you are, use props like blocks or straps, and never force a stretch. Consistency is key: even 10 minutes daily will show noticeable improvement within a few weeks. 💪",
  },
  {
    keywords: ['injury', 'pain', 'hurt', 'safe', 'safety', 'careful', 'knee', 'back pain'],
    response:
      'Safety first! If you feel sharp pain, stop immediately. Always listen to your body — mild stretching is fine, but pain is not. For knee sensitivity, avoid deep bends. For back issues, keep your core engaged and avoid extreme forward folds. If you have a medical condition, consult your doctor before practicing. ⚕️',
  },
  {
    keywords: ['beginner', 'new', 'first time', 'started', 'starting'],
    response:
      "Welcome to your yoga journey! Start with foundational poses like Tadasana (Mountain), Warrior II, and Tree Pose. Focus on alignment over depth — it's more important to do a pose correctly than deeply. Practice 2-3 times a week and gradually increase. You're doing great by being here! 🌟",
  },
  {
    keywords: ['warrior', 'virabhadrasana'],
    response:
      "Warrior II (Virabhadrasana II) is a powerful standing pose. Key cues: front knee over ankle (not past toes), back leg straight and strong, arms extended parallel to the floor, and gaze over your front fingers. Keep your torso centred — don't lean forward! ⚔️",
  },
  {
    keywords: ['tree', 'vrksasana', 'balance'],
    response:
      "Tree Pose (Vrksasana) is wonderful for balance! Place your foot on your inner thigh or calf — never on the knee. Fix your gaze on a steady point (drishti). Start with hands at heart centre, then try raising them overhead. If you wobble, that's perfectly normal — balance improves with practice! 🌳",
  },
  {
    keywords: ['mountain', 'tadasana', 'standing'],
    response:
      'Tadasana (Mountain Pose) is deceptively simple but foundational. Stand with feet together, distribute weight evenly, engage your thighs, tuck your tailbone slightly, roll shoulders back and down, and reach through the crown of your head. It teaches body awareness and perfect posture. 🏔️',
  },
  {
    keywords: ['down dog', 'downward', 'adho mukha'],
    response:
      "Downward-Facing Dog is a full-body stretch! Hands shoulder-width, feet hip-width, hips high. Press through your fingers (don't dump weight into wrists). It's okay if your heels don't touch the floor — slightly bent knees are fine. Focus on lengthening your spine. 🐕",
  },
  {
    keywords: ['plank', 'phalakasana', 'core'],
    response:
      "Plank Pose builds amazing core strength! Align wrists under shoulders, engage your core to keep hips level (not sagging or piking), and push the floor away. Hold for 20-30 seconds as a beginner, building up over time. Remember to breathe — don't hold your breath! 💪",
  },
  {
    keywords: ['goddess', 'utkata konasana', 'squat'],
    response:
      'Goddess Pose (Utkata Konasana) is a deep hip opener! Stand wide, turn toes out 45°, and sink your hips to knee height. Keep knees tracking over toes and your torso upright. Arms can be in goalpost position or overhead. It builds serious leg strength! 👑',
  },
  {
    keywords: ['how long', 'duration', 'hold', 'time'],
    response:
      'For beginners, hold each pose for 5-10 breaths (about 30-60 seconds). As you advance, you can hold longer — up to 2-3 minutes for restorative poses. For flow sequences, transition with each breath. Quality matters more than duration! ⏱️',
  },
  {
    keywords: ['meditation', 'meditate', 'mindful', 'calm', 'stress', 'relax'],
    response:
      'Yoga and meditation go hand in hand! After your physical practice, try sitting quietly for 5 minutes. Focus on your breath, and gently redirect your mind when it wanders. Even short meditation sessions reduce stress, improve focus, and bring a sense of calm. 🧘',
  },
  {
    keywords: ['diet', 'eat', 'food', 'nutrition'],
    response:
      'Practice yoga on a light stomach — wait at least 2 hours after a heavy meal. Stay hydrated before and after practice. A balanced diet with plenty of fruits, vegetables, whole grains, and lean protein supports your yoga practice. Listen to your body! 🥗',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good evening'],
    response:
      'Namaste! 🙏 How can I help you with your yoga practice today? Feel free to ask about poses, breathing, benefits, or any yoga-related question!',
  },
  {
    keywords: ['thank', 'thanks', 'appreciate'],
    response:
      "You're welcome! 😊 Keep up your wonderful yoga practice. I'm here whenever you need guidance or have questions. Namaste! 🙏",
  },
  {
    keywords: ['oorjakull', 'app', 'what is this', 'how does this work', 'features'],
    response:
      "OorjaKull AI Yoga uses your camera and AI to evaluate your yoga poses in real-time! Select a pose, step into the frame, and our AI will analyse your alignment and give you personalised feedback with a score. I'll track all your results right here in our chat! 📱✨",
  },
  {
    keywords: ['score', 'scoring', 'how scored', 'points'],
    response:
      'Your score is calculated from biomechanical analysis of joint angles, symmetry, and stability compared to the ideal pose template. A score of 90+ is excellent, 70-89 is good, and below 70 means there are key areas to improve. Each attempt helps you learn! 📊',
  },
]

const FALLBACK_RESPONSES = [
  "That's an interesting question! While I'm best with yoga-related topics, feel free to ask about poses, breathing, benefits, or your practice. 🧘",
  "I'm your yoga companion, so I may not have the answer to that specific question. But ask me anything about yoga poses, techniques, or your session progress!",
  "Hmm, I'm not sure about that one. Try asking me about a specific pose, breathing techniques, yoga benefits, or how to get started! 🙏",
]

export function getBotResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase()

  for (const entry of YOGA_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.response
    }
  }

  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)]
}
