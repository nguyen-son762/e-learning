import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface SeedCard {
  front: string;
  back: string;
  example: string;
}

interface SeedTopic {
  slug: string;
  title: string;
  titleVi: string;
  description: string;
  cards: SeedCard[];
}

const topics: SeedTopic[] = [
  {
    slug: "travel",
    title: "Travel",
    titleVi: "Du lịch",
    description: "Từ vựng thường dùng khi đi du lịch và sân bay.",
    cards: [
      { front: "airport", back: "sân bay", example: "We arrived at the airport two hours early." },
      { front: "luggage", back: "hành lý", example: "My luggage was too heavy to carry." },
      { front: "passport", back: "hộ chiếu", example: "Please show your passport at the gate." },
      { front: "boarding pass", back: "thẻ lên máy bay", example: "Keep your boarding pass ready." },
      { front: "departure", back: "sự khởi hành", example: "The departure time is 9:30 AM." },
      { front: "arrival", back: "sự đến nơi", example: "Our arrival was delayed by an hour." },
      { front: "customs", back: "hải quan", example: "We waited in line at customs." },
      { front: "souvenir", back: "quà lưu niệm", example: "She bought a souvenir for her sister." },
      { front: "itinerary", back: "lịch trình", example: "Our itinerary includes three cities." },
      { front: "reservation", back: "việc đặt chỗ", example: "I made a reservation at the hotel." },
    ],
  },
  {
    slug: "business",
    title: "Business",
    titleVi: "Kinh doanh",
    description: "Từ vựng văn phòng và môi trường kinh doanh.",
    cards: [
      { front: "meeting", back: "cuộc họp", example: "The meeting starts at 10 o'clock." },
      { front: "deadline", back: "hạn chót", example: "We must finish before the deadline." },
      { front: "invoice", back: "hóa đơn", example: "Please send the invoice by email." },
      { front: "client", back: "khách hàng", example: "Our biggest client signed the contract." },
      { front: "revenue", back: "doanh thu", example: "Revenue increased by ten percent." },
      { front: "negotiate", back: "đàm phán", example: "They will negotiate the price tomorrow." },
      { front: "schedule", back: "lịch trình", example: "Let's schedule a call for Friday." },
      { front: "colleague", back: "đồng nghiệp", example: "My colleague helped me with the report." },
      { front: "budget", back: "ngân sách", example: "The project went over budget." },
      { front: "proposal", back: "đề xuất", example: "She presented a new business proposal." },
    ],
  },
  {
    slug: "daily-life",
    title: "Daily Life",
    titleVi: "Cuộc sống hằng ngày",
    description: "Từ vựng cho các hoạt động thường ngày.",
    cards: [
      { front: "breakfast", back: "bữa sáng", example: "I usually have breakfast at seven." },
      { front: "commute", back: "việc đi lại (đi làm)", example: "My commute takes thirty minutes." },
      { front: "grocery", back: "hàng tạp hóa", example: "I bought some groceries after work." },
      { front: "laundry", back: "việc giặt giũ", example: "I do the laundry on weekends." },
      { front: "neighbor", back: "hàng xóm", example: "My neighbor is very friendly." },
      { front: "errand", back: "việc vặt", example: "I have a few errands to run today." },
      { front: "chores", back: "việc nhà", example: "The kids help with household chores." },
      { front: "appointment", back: "cuộc hẹn", example: "I have a doctor's appointment at noon." },
      { front: "routine", back: "thói quen hằng ngày", example: "Exercise is part of my morning routine." },
      { front: "leftovers", back: "đồ ăn thừa", example: "We ate the leftovers for lunch." },
    ],
  },
  {
    slug: "food",
    title: "Food & Dining",
    titleVi: "Ẩm thực",
    description: "Từ vựng về món ăn và nhà hàng.",
    cards: [
      { front: "appetizer", back: "món khai vị", example: "We ordered an appetizer to share." },
      { front: "beverage", back: "đồ uống", example: "Would you like a beverage with your meal?" },
      { front: "recipe", back: "công thức nấu ăn", example: "This recipe needs three eggs." },
      { front: "delicious", back: "ngon", example: "The soup was absolutely delicious." },
      { front: "vegetarian", back: "người ăn chay", example: "She is a vegetarian and avoids meat." },
      { front: "spicy", back: "cay", example: "The curry was too spicy for me." },
      { front: "dessert", back: "món tráng miệng", example: "For dessert we had ice cream." },
      { front: "tip", back: "tiền boa", example: "We left a generous tip for the waiter." },
      { front: "menu", back: "thực đơn", example: "Could I see the menu, please?" },
      { front: "bill", back: "hóa đơn (nhà hàng)", example: "Can we have the bill, please?" },
    ],
  },
];

interface SeedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

interface SeedExercise {
  slug: string;
  title: string;
  level: string;
  passage: string;
  questions: SeedQuestion[];
}

const exercises: SeedExercise[] = [
  {
    slug: "city-life",
    title: "City Life",
    level: "beginner",
    passage:
      "Living in a big city has many advantages. Cities offer a wide range of jobs, so people can find work in many different fields. Public transportation, such as buses and trains, makes it easy to travel without a car. There are also many restaurants, museums, and parks to enjoy. However, city life can be expensive. Rent is often high, and the streets can be crowded and noisy. Despite these challenges, many people choose to live in cities because of the opportunities and excitement they offer.",
    questions: [
      {
        prompt: "What does the passage mainly discuss?",
        options: ["City life", "Farming", "Weather", "Sports"],
        correctIndex: 0,
      },
      {
        prompt: "Which is mentioned as an advantage of cities?",
        options: ["Quiet streets", "Many jobs", "Clean air", "Cheap rent"],
        correctIndex: 1,
      },
      {
        prompt: "How can people travel in the city without a car?",
        options: ["By plane", "By boat", "By public transportation", "By bicycle only"],
        correctIndex: 2,
      },
      {
        prompt: "What is one disadvantage of city life mentioned?",
        options: ["No restaurants", "Few jobs", "High rent", "No parks"],
        correctIndex: 2,
      },
      {
        prompt: "Why do many people still choose to live in cities?",
        options: [
          "Because it is cheap",
          "Because of the opportunities and excitement",
          "Because it is quiet",
          "Because there are no challenges",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: "morning-routine",
    title: "A Morning Routine",
    level: "beginner",
    passage:
      "Anna wakes up at six o'clock every morning. First, she drinks a glass of water and stretches for a few minutes. Then she goes for a short run in the park near her house. After her run, she takes a shower and prepares a healthy breakfast, usually eggs and fruit. By seven thirty, she is ready for work. Anna believes that a calm and active morning helps her feel focused for the rest of the day.",
    questions: [
      {
        prompt: "What time does Anna wake up?",
        options: ["Five o'clock", "Six o'clock", "Seven o'clock", "Eight o'clock"],
        correctIndex: 1,
      },
      {
        prompt: "What does Anna do first after waking up?",
        options: ["Goes for a run", "Takes a shower", "Drinks water and stretches", "Eats breakfast"],
        correctIndex: 2,
      },
      {
        prompt: "Where does Anna run?",
        options: ["On a treadmill", "In the park", "On the beach", "At the gym"],
        correctIndex: 1,
      },
      {
        prompt: "What does Anna usually eat for breakfast?",
        options: ["Eggs and fruit", "Toast and coffee", "Cereal", "Nothing"],
        correctIndex: 0,
      },
    ],
  },
  {
    slug: "the-job-interview",
    title: "The Job Interview",
    level: "intermediate",
    passage:
      "Preparing for a job interview can reduce stress and improve your chances of success. Before the interview, research the company so you understand its products and values. Practice answering common questions, such as describing your strengths and weaknesses. Dress professionally and arrive at least ten minutes early. During the interview, listen carefully and answer clearly. At the end, it is a good idea to ask a thoughtful question about the role. Sending a short thank-you email afterward can also leave a positive impression.",
    questions: [
      {
        prompt: "What is the main purpose of the passage?",
        options: [
          "To describe a company",
          "To give advice on job interviews",
          "To explain how to write emails",
          "To list common jobs",
        ],
        correctIndex: 1,
      },
      {
        prompt: "What should you do before the interview?",
        options: [
          "Research the company",
          "Arrive late",
          "Avoid practicing",
          "Wear casual clothes",
        ],
        correctIndex: 0,
      },
      {
        prompt: "How early should you arrive?",
        options: ["At the exact time", "Ten minutes early", "One hour early", "Five minutes late"],
        correctIndex: 1,
      },
      {
        prompt: "What is suggested to do at the end of the interview?",
        options: [
          "Leave immediately",
          "Ask a thoughtful question",
          "Criticize the company",
          "Request the salary first",
        ],
        correctIndex: 1,
      },
      {
        prompt: "What can leave a positive impression after the interview?",
        options: [
          "Calling many times",
          "Sending a thank-you email",
          "Doing nothing",
          "Visiting the office again",
        ],
        correctIndex: 1,
      },
    ],
  },
];

interface SeedVocab {
  word: string;
  meaning: string;
  pronunciation?: string;
  partOfSpeech?: string;
  synonyms?: string[];
  antonyms?: string[];
  exampleSentence?: string;
  notes?: string;
  tags?: string[];
  cefrLevel?: string;
  isFavorite?: boolean;
  known?: boolean;
}

const vocabSeed: SeedVocab[] = [
  {
    word: "ubiquitous",
    meaning: "có mặt khắp nơi",
    pronunciation: "/juːˈbɪkwɪtəs/",
    partOfSpeech: "adjective",
    synonyms: ["omnipresent", "pervasive"],
    antonyms: ["rare"],
    exampleSentence: "Smartphones are ubiquitous nowadays.",
    notes: "ôn lại tuần sau",
    tags: ["IELTS", "C1"],
    cefrLevel: "C1",
    isFavorite: true,
  },
  {
    word: "diligent",
    meaning: "siêng năng, cần cù",
    pronunciation: "/ˈdɪlɪdʒənt/",
    partOfSpeech: "adjective",
    synonyms: ["hardworking", "industrious"],
    antonyms: ["lazy"],
    exampleSentence: "She is a diligent student.",
    tags: ["business"],
    cefrLevel: "B2",
    known: true,
  },
  {
    word: "commute",
    meaning: "việc đi lại (đi làm)",
    partOfSpeech: "noun",
    tags: ["daily-life"],
    cefrLevel: "B1",
  },
];

async function main() {
  // Demo user (idempotent).
  const passwordHash = await bcrypt.hash("secret123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "Demo Learner", passwordHash },
  });

  // Demo vocabulary (idempotent: only seed if the user has none yet).
  const existingVocab = await prisma.vocabularyEntry.count({
    where: { userId: demoUser.id },
  });
  if (existingVocab === 0) {
    await prisma.vocabularyEntry.createMany({
      data: vocabSeed.map((v) => ({
        userId: demoUser.id,
        word: v.word,
        meaning: v.meaning,
        pronunciation: v.pronunciation ?? null,
        partOfSpeech: v.partOfSpeech ?? null,
        synonyms: v.synonyms ?? [],
        antonyms: v.antonyms ?? [],
        exampleSentence: v.exampleSentence ?? null,
        notes: v.notes ?? null,
        tags: v.tags ?? [],
        cefrLevel: v.cefrLevel ?? null,
        isFavorite: v.isFavorite ?? false,
        known: v.known ?? false,
      })),
    });
  }

  // Topics + flashcards (clear and re-create for deterministic seed).
  for (const [tIndex, t] of topics.entries()) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        titleVi: t.titleVi,
        description: t.description,
        order: tIndex,
      },
      create: {
        slug: t.slug,
        title: t.title,
        titleVi: t.titleVi,
        description: t.description,
        order: tIndex,
      },
    });
    const topic = await prisma.topic.findUniqueOrThrow({ where: { slug: t.slug } });

    // Replace this topic's flashcards.
    await prisma.flashcard.deleteMany({ where: { topicId: topic.id } });
    await prisma.flashcard.createMany({
      data: t.cards.map((c, i) => ({
        topicId: topic.id,
        front: c.front,
        back: c.back,
        example: c.example,
        order: i,
      })),
    });
  }

  // Reading exercises + questions.
  for (const [eIndex, e] of exercises.entries()) {
    await prisma.readingExercise.upsert({
      where: { slug: e.slug },
      update: {
        title: e.title,
        level: e.level,
        passage: e.passage,
        order: eIndex,
      },
      create: {
        slug: e.slug,
        title: e.title,
        level: e.level,
        passage: e.passage,
        order: eIndex,
      },
    });
    const exercise = await prisma.readingExercise.findUniqueOrThrow({
      where: { slug: e.slug },
    });

    await prisma.readingQuestion.deleteMany({ where: { exerciseId: exercise.id } });
    for (const [qIndex, q] of e.questions.entries()) {
      await prisma.readingQuestion.create({
        data: {
          exerciseId: exercise.id,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          order: qIndex,
        },
      });
    }
  }

  // Admin user (idempotent)
  const adminHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@elearning.com" },
    update: {},
    create: {
      email: "admin@elearning.com",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${topics.length} topics, ${exercises.length} reading exercises, ${vocabSeed.length} vocabulary entries (if empty), demo user (demo@example.com / secret123), admin user (admin@elearning.com / Admin@123).`
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
