import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Language = "en" | "zh";

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
  language: Language;
  cards: SeedCard[];
}

// =========================================================================================
// English topics (v1 — unchanged).
// =========================================================================================

const englishTopics: SeedTopic[] = [
  {
    slug: "travel",
    title: "Travel",
    titleVi: "Du lịch",
    description: "Từ vựng thường dùng khi đi du lịch và sân bay.",
    language: "en",
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
    language: "en",
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
    language: "en",
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
    language: "en",
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

// =========================================================================================
// Chinese topics (v6 — HSK 1-3). Pinyin uses tone marks (mā/má/mǎ/mà). `back` is "pinyin —
// nghĩa Việt"; `example` is "汉字句子. Pīnyīn jùzi. (Nghĩa Việt.)".
// =========================================================================================

const chineseTopics: SeedTopic[] = [
  // ============================================ HSK 1 (5 topics) ============================================
  {
    slug: "hsk1-numbers",
    title: "HSK 1 — Numbers",
    titleVi: "HSK 1 — Số đếm",
    description: "Số đếm cơ bản từ 0 đến 10 và một số đơn vị thường gặp.",
    language: "zh",
    cards: [
      { front: "零", back: "líng — số không", example: "我有零个苹果。Wǒ yǒu líng gè píngguǒ. (Tôi có không quả táo.)" },
      { front: "一", back: "yī — số một", example: "我有一本书。Wǒ yǒu yī běn shū. (Tôi có một quyển sách.)" },
      { front: "二", back: "èr — số hai", example: "我有二只猫。Wǒ yǒu èr zhī māo. (Tôi có hai con mèo.)" },
      { front: "三", back: "sān — số ba", example: "三个学生。Sān gè xuéshēng. (Ba học sinh.)" },
      { front: "四", back: "sì — số bốn", example: "四点钟。Sì diǎn zhōng. (Bốn giờ.)" },
      { front: "五", back: "wǔ — số năm", example: "五个朋友。Wǔ gè péngyǒu. (Năm người bạn.)" },
      { front: "六", back: "liù — số sáu", example: "六月很热。Liù yuè hěn rè. (Tháng sáu rất nóng.)" },
      { front: "七", back: "qī — số bảy", example: "一周有七天。Yī zhōu yǒu qī tiān. (Một tuần có bảy ngày.)" },
      { front: "八", back: "bā — số tám", example: "八点上课。Bā diǎn shàngkè. (Tám giờ vào lớp.)" },
      { front: "九", back: "jiǔ — số chín", example: "九个月。Jiǔ gè yuè. (Chín tháng.)" },
      { front: "十", back: "shí — số mười", example: "十个手指。Shí gè shǒuzhǐ. (Mười ngón tay.)" },
      { front: "百", back: "bǎi — trăm", example: "一百块钱。Yī bǎi kuài qián. (Một trăm tệ.)" },
      { front: "千", back: "qiān — nghìn", example: "一千年。Yī qiān nián. (Một nghìn năm.)" },
      { front: "万", back: "wàn — vạn (mười nghìn)", example: "一万人。Yī wàn rén. (Một vạn người.)" },
      { front: "个", back: "gè — cái, lượng từ chung", example: "一个人。Yī gè rén. (Một người.)" },
    ],
  },
  {
    slug: "hsk1-colors",
    title: "HSK 1 — Colors",
    titleVi: "HSK 1 — Màu sắc",
    description: "Các màu sắc cơ bản trong tiếng Trung.",
    language: "zh",
    cards: [
      { front: "红", back: "hóng — màu đỏ", example: "红色的花。Hóngsè de huā. (Bông hoa màu đỏ.)" },
      { front: "黄", back: "huáng — màu vàng", example: "黄色的香蕉。Huángsè de xiāngjiāo. (Quả chuối màu vàng.)" },
      { front: "蓝", back: "lán — màu xanh dương", example: "蓝色的天空。Lánsè de tiānkōng. (Bầu trời màu xanh.)" },
      { front: "绿", back: "lǜ — màu xanh lá", example: "绿色的树。Lǜsè de shù. (Cây màu xanh lá.)" },
      { front: "白", back: "bái — màu trắng", example: "白色的雪。Báisè de xuě. (Tuyết màu trắng.)" },
      { front: "黑", back: "hēi — màu đen", example: "黑色的猫。Hēisè de māo. (Con mèo màu đen.)" },
      { front: "灰", back: "huī — màu xám", example: "灰色的云。Huīsè de yún. (Đám mây màu xám.)" },
      { front: "粉", back: "fěn — màu hồng", example: "粉色的裙子。Fěnsè de qúnzi. (Chiếc váy màu hồng.)" },
      { front: "紫", back: "zǐ — màu tím", example: "紫色的葡萄。Zǐsè de pútáo. (Quả nho màu tím.)" },
      { front: "色", back: "sè — màu sắc", example: "你喜欢什么颜色？Nǐ xǐhuān shénme yánsè? (Bạn thích màu gì?)" },
      { front: "颜色", back: "yánsè — màu sắc", example: "这个颜色很好看。Zhège yánsè hěn hǎokàn. (Màu này đẹp lắm.)" },
      { front: "橙", back: "chéng — màu cam", example: "橙色的太阳。Chéngsè de tàiyáng. (Mặt trời màu cam.)" },
      { front: "棕", back: "zōng — màu nâu", example: "棕色的眼睛。Zōngsè de yǎnjīng. (Đôi mắt màu nâu.)" },
      { front: "深", back: "shēn — đậm (màu)", example: "深蓝色。Shēn lánsè. (Màu xanh dương đậm.)" },
      { front: "浅", back: "qiǎn — nhạt (màu)", example: "浅绿色。Qiǎn lǜsè. (Màu xanh lá nhạt.)" },
    ],
  },
  {
    slug: "hsk1-family",
    title: "HSK 1 — Family",
    titleVi: "HSK 1 — Gia đình",
    description: "Từ vựng về các thành viên trong gia đình.",
    language: "zh",
    cards: [
      { front: "家", back: "jiā — nhà, gia đình", example: "我的家很大。Wǒ de jiā hěn dà. (Nhà tôi rất rộng.)" },
      { front: "爸爸", back: "bàba — bố", example: "我爸爸是老师。Wǒ bàba shì lǎoshī. (Bố tôi là giáo viên.)" },
      { front: "妈妈", back: "māma — mẹ", example: "妈妈做饭。Māma zuòfàn. (Mẹ nấu cơm.)" },
      { front: "哥哥", back: "gēge — anh trai", example: "我有一个哥哥。Wǒ yǒu yī gè gēge. (Tôi có một anh trai.)" },
      { front: "姐姐", back: "jiějie — chị gái", example: "姐姐很漂亮。Jiějie hěn piàoliang. (Chị gái rất xinh.)" },
      { front: "弟弟", back: "dìdi — em trai", example: "弟弟在玩。Dìdi zài wán. (Em trai đang chơi.)" },
      { front: "妹妹", back: "mèimei — em gái", example: "我的妹妹五岁。Wǒ de mèimei wǔ suì. (Em gái tôi năm tuổi.)" },
      { front: "儿子", back: "érzi — con trai", example: "他有两个儿子。Tā yǒu liǎng gè érzi. (Anh ấy có hai con trai.)" },
      { front: "女儿", back: "nǚ'ér — con gái", example: "她的女儿很聪明。Tā de nǚ'ér hěn cōngmíng. (Con gái cô ấy rất thông minh.)" },
      { front: "爷爷", back: "yéye — ông nội", example: "爷爷七十岁。Yéye qīshí suì. (Ông nội bảy mươi tuổi.)" },
      { front: "奶奶", back: "nǎinai — bà nội", example: "奶奶做的菜很好吃。Nǎinai zuò de cài hěn hǎochī. (Món bà nội nấu rất ngon.)" },
      { front: "丈夫", back: "zhàngfu — chồng", example: "我的丈夫是医生。Wǒ de zhàngfu shì yīshēng. (Chồng tôi là bác sĩ.)" },
      { front: "妻子", back: "qīzi — vợ", example: "他的妻子很温柔。Tā de qīzi hěn wēnróu. (Vợ anh ấy rất dịu dàng.)" },
      { front: "孩子", back: "háizi — đứa trẻ / con", example: "她有两个孩子。Tā yǒu liǎng gè háizi. (Cô ấy có hai đứa con.)" },
      { front: "父母", back: "fùmǔ — bố mẹ", example: "我爱我的父母。Wǒ ài wǒ de fùmǔ. (Tôi yêu bố mẹ tôi.)" },
    ],
  },
  {
    slug: "hsk1-greetings",
    title: "HSK 1 — Greetings",
    titleVi: "HSK 1 — Chào hỏi",
    description: "Các câu chào hỏi và lịch sự cơ bản.",
    language: "zh",
    cards: [
      { front: "你好", back: "nǐ hǎo — xin chào", example: "你好！很高兴认识你。Nǐ hǎo! Hěn gāoxìng rènshí nǐ. (Xin chào! Rất vui được gặp bạn.)" },
      { front: "您好", back: "nín hǎo — chào (kính trọng)", example: "老师，您好！Lǎoshī, nín hǎo! (Thưa thầy/cô, xin chào!)" },
      { front: "再见", back: "zàijiàn — tạm biệt", example: "明天见，再见！Míngtiān jiàn, zàijiàn! (Hẹn ngày mai, tạm biệt!)" },
      { front: "谢谢", back: "xièxie — cảm ơn", example: "谢谢你的帮助。Xièxie nǐ de bāngzhù. (Cảm ơn sự giúp đỡ của bạn.)" },
      { front: "对不起", back: "duìbuqǐ — xin lỗi", example: "对不起，我迟到了。Duìbuqǐ, wǒ chídào le. (Xin lỗi, tôi đến muộn rồi.)" },
      { front: "没关系", back: "méi guānxi — không sao", example: "没关系，我不生气。Méi guānxi, wǒ bù shēngqì. (Không sao, tôi không giận.)" },
      { front: "请", back: "qǐng — xin mời / làm ơn", example: "请坐。Qǐng zuò. (Mời ngồi.)" },
      { front: "早上好", back: "zǎoshang hǎo — chào buổi sáng", example: "早上好，老师！Zǎoshang hǎo, lǎoshī! (Chào buổi sáng, thầy/cô!)" },
      { front: "晚上好", back: "wǎnshang hǎo — chào buổi tối", example: "晚上好，大家。Wǎnshang hǎo, dàjiā. (Chào buổi tối, mọi người.)" },
      { front: "晚安", back: "wǎn'ān — chúc ngủ ngon", example: "晚安，做个好梦。Wǎn'ān, zuò gè hǎo mèng. (Ngủ ngon, mơ giấc mơ đẹp.)" },
      { front: "认识", back: "rènshi — quen biết", example: "很高兴认识你。Hěn gāoxìng rènshí nǐ. (Rất vui được quen biết bạn.)" },
      { front: "欢迎", back: "huānyíng — chào mừng", example: "欢迎来中国。Huānyíng lái Zhōngguó. (Chào mừng đến Trung Quốc.)" },
      { front: "好", back: "hǎo — tốt / khỏe", example: "你好吗？我很好。Nǐ hǎo ma? Wǒ hěn hǎo. (Bạn khỏe không? Tôi khỏe.)" },
      { front: "名字", back: "míngzi — tên", example: "你叫什么名字？Nǐ jiào shénme míngzi? (Bạn tên gì?)" },
      { front: "叫", back: "jiào — gọi / tên là", example: "我叫小明。Wǒ jiào Xiǎomíng. (Tôi tên là Tiểu Minh.)" },
    ],
  },
  {
    slug: "hsk1-pronouns",
    title: "HSK 1 — Pronouns",
    titleVi: "HSK 1 — Đại từ",
    description: "Các đại từ nhân xưng và đại từ chỉ định cơ bản.",
    language: "zh",
    cards: [
      { front: "我", back: "wǒ — tôi", example: "我是越南人。Wǒ shì Yuènán rén. (Tôi là người Việt Nam.)" },
      { front: "你", back: "nǐ — bạn", example: "你叫什么名字？Nǐ jiào shénme míngzì? (Bạn tên gì?)" },
      { front: "您", back: "nín — ngài (kính trọng)", example: "您好。Nín hǎo. (Chào ngài.)" },
      { front: "他", back: "tā — anh ấy", example: "他是我的朋友。Tā shì wǒ de péngyǒu. (Anh ấy là bạn của tôi.)" },
      { front: "她", back: "tā — cô ấy", example: "她很漂亮。Tā hěn piàoliang. (Cô ấy rất xinh.)" },
      { front: "我们", back: "wǒmen — chúng tôi/chúng ta", example: "我们是同学。Wǒmen shì tóngxué. (Chúng tôi là bạn học.)" },
      { front: "你们", back: "nǐmen — các bạn", example: "你们好。Nǐmen hǎo. (Chào các bạn.)" },
      { front: "他们", back: "tāmen — họ (nam)", example: "他们在学校。Tāmen zài xuéxiào. (Họ ở trường.)" },
      { front: "她们", back: "tāmen — họ (nữ)", example: "她们是老师。Tāmen shì lǎoshī. (Họ là giáo viên.)" },
      { front: "这", back: "zhè — này, cái này", example: "这是我的书。Zhè shì wǒ de shū. (Đây là sách của tôi.)" },
      { front: "那", back: "nà — đó, cái đó", example: "那是什么？Nà shì shénme? (Đó là cái gì?)" },
      { front: "谁", back: "shéi — ai", example: "他是谁？Tā shì shéi? (Anh ấy là ai?)" },
      { front: "什么", back: "shénme — cái gì", example: "你吃什么？Nǐ chī shénme? (Bạn ăn gì?)" },
      { front: "哪", back: "nǎ — nào", example: "你是哪国人？Nǐ shì nǎ guó rén? (Bạn là người nước nào?)" },
      { front: "哪里", back: "nǎli — ở đâu", example: "你在哪里？Nǐ zài nǎli? (Bạn ở đâu?)" },
      { front: "几", back: "jǐ — mấy (số nhỏ)", example: "你家有几个人？Nǐ jiā yǒu jǐ gè rén? (Nhà bạn có mấy người?)" },
    ],
  },

  // ============================================ HSK 2 (5 topics) ============================================
  {
    slug: "hsk2-actions",
    title: "HSK 2 — Actions",
    titleVi: "HSK 2 — Hành động",
    description: "Các động từ hành động thường dùng.",
    language: "zh",
    cards: [
      { front: "吃", back: "chī — ăn", example: "我吃饭。Wǒ chī fàn. (Tôi ăn cơm.)" },
      { front: "喝", back: "hē — uống", example: "我喝水。Wǒ hē shuǐ. (Tôi uống nước.)" },
      { front: "看", back: "kàn — xem, nhìn", example: "我看电视。Wǒ kàn diànshì. (Tôi xem tivi.)" },
      { front: "听", back: "tīng — nghe", example: "我听音乐。Wǒ tīng yīnyuè. (Tôi nghe nhạc.)" },
      { front: "说", back: "shuō — nói", example: "他说汉语。Tā shuō Hànyǔ. (Anh ấy nói tiếng Trung.)" },
      { front: "读", back: "dú — đọc", example: "我在读书。Wǒ zài dúshū. (Tôi đang đọc sách.)" },
      { front: "写", back: "xiě — viết", example: "她写字很漂亮。Tā xiě zì hěn piàoliang. (Cô ấy viết chữ rất đẹp.)" },
      { front: "走", back: "zǒu — đi (bộ)", example: "我走路去学校。Wǒ zǒulù qù xuéxiào. (Tôi đi bộ đến trường.)" },
      { front: "跑", back: "pǎo — chạy", example: "他跑得很快。Tā pǎo de hěn kuài. (Anh ấy chạy rất nhanh.)" },
      { front: "跳", back: "tiào — nhảy", example: "小孩跳起来。Xiǎohái tiào qǐlái. (Đứa bé nhảy lên.)" },
      { front: "买", back: "mǎi — mua", example: "我买了一本书。Wǒ mǎi le yī běn shū. (Tôi đã mua một quyển sách.)" },
      { front: "卖", back: "mài — bán", example: "他卖水果。Tā mài shuǐguǒ. (Anh ấy bán trái cây.)" },
      { front: "做", back: "zuò — làm", example: "我做作业。Wǒ zuò zuòyè. (Tôi làm bài tập.)" },
      { front: "睡觉", back: "shuìjiào — ngủ", example: "我十点睡觉。Wǒ shí diǎn shuìjiào. (Tôi ngủ lúc mười giờ.)" },
      { front: "起床", back: "qǐchuáng — thức dậy", example: "我六点起床。Wǒ liù diǎn qǐchuáng. (Tôi dậy lúc sáu giờ.)" },
    ],
  },
  {
    slug: "hsk2-time",
    title: "HSK 2 — Time",
    titleVi: "HSK 2 — Thời gian",
    description: "Từ vựng về thời gian, ngày, tháng, năm.",
    language: "zh",
    cards: [
      { front: "今天", back: "jīntiān — hôm nay", example: "今天天气很好。Jīntiān tiānqì hěn hǎo. (Hôm nay thời tiết đẹp.)" },
      { front: "昨天", back: "zuótiān — hôm qua", example: "昨天我去公园。Zuótiān wǒ qù gōngyuán. (Hôm qua tôi đi công viên.)" },
      { front: "明天", back: "míngtiān — ngày mai", example: "明天见。Míngtiān jiàn. (Hẹn gặp ngày mai.)" },
      { front: "现在", back: "xiànzài — bây giờ", example: "现在几点？Xiànzài jǐ diǎn? (Bây giờ mấy giờ?)" },
      { front: "早上", back: "zǎoshang — buổi sáng", example: "早上我喝咖啡。Zǎoshang wǒ hē kāfēi. (Buổi sáng tôi uống cà phê.)" },
      { front: "中午", back: "zhōngwǔ — buổi trưa", example: "中午我们一起吃饭。Zhōngwǔ wǒmen yīqǐ chīfàn. (Trưa chúng ta ăn cơm cùng nhau.)" },
      { front: "下午", back: "xiàwǔ — buổi chiều", example: "下午我有课。Xiàwǔ wǒ yǒu kè. (Chiều tôi có lớp.)" },
      { front: "晚上", back: "wǎnshang — buổi tối", example: "晚上我看书。Wǎnshang wǒ kànshū. (Tối tôi đọc sách.)" },
      { front: "年", back: "nián — năm", example: "今年是二〇二六年。Jīnnián shì èr líng èr liù nián. (Năm nay là 2026.)" },
      { front: "月", back: "yuè — tháng", example: "一月很冷。Yī yuè hěn lěng. (Tháng Một rất lạnh.)" },
      { front: "日", back: "rì — ngày", example: "今天是六月十三日。Jīntiān shì liù yuè shísān rì. (Hôm nay là ngày 13 tháng 6.)" },
      { front: "星期", back: "xīngqī — tuần", example: "下星期我去北京。Xià xīngqī wǒ qù Běijīng. (Tuần sau tôi đi Bắc Kinh.)" },
      { front: "小时", back: "xiǎoshí — giờ (khoảng thời gian)", example: "我学了两个小时。Wǒ xué le liǎng gè xiǎoshí. (Tôi học hai tiếng.)" },
      { front: "分钟", back: "fēnzhōng — phút", example: "再等五分钟。Zài děng wǔ fēnzhōng. (Đợi thêm năm phút.)" },
    ],
  },
  {
    slug: "hsk2-places",
    title: "HSK 2 — Places",
    titleVi: "HSK 2 — Địa điểm",
    description: "Tên các địa điểm thường gặp.",
    language: "zh",
    cards: [
      { front: "学校", back: "xuéxiào — trường học", example: "我在学校学习。Wǒ zài xuéxiào xuéxí. (Tôi học ở trường.)" },
      { front: "医院", back: "yīyuàn — bệnh viện", example: "他在医院工作。Tā zài yīyuàn gōngzuò. (Anh ấy làm việc ở bệnh viện.)" },
      { front: "商店", back: "shāngdiàn — cửa hàng", example: "我去商店买东西。Wǒ qù shāngdiàn mǎi dōngxī. (Tôi đi cửa hàng mua đồ.)" },
      { front: "银行", back: "yínháng — ngân hàng", example: "银行九点开门。Yínháng jiǔ diǎn kāimén. (Ngân hàng mở cửa lúc chín giờ.)" },
      { front: "饭店", back: "fàndiàn — nhà hàng/khách sạn", example: "我们在饭店吃饭。Wǒmen zài fàndiàn chīfàn. (Chúng tôi ăn cơm ở nhà hàng.)" },
      { front: "公园", back: "gōngyuán — công viên", example: "孩子们在公园玩。Háizimen zài gōngyuán wán. (Bọn trẻ chơi ở công viên.)" },
      { front: "图书馆", back: "túshūguǎn — thư viện", example: "图书馆很安静。Túshūguǎn hěn ānjìng. (Thư viện rất yên tĩnh.)" },
      { front: "机场", back: "jīchǎng — sân bay", example: "我去机场。Wǒ qù jīchǎng. (Tôi đi sân bay.)" },
      { front: "火车站", back: "huǒchēzhàn — ga tàu", example: "火车站离这儿很近。Huǒchēzhàn lí zhèr hěn jìn. (Ga tàu cách đây rất gần.)" },
      { front: "教室", back: "jiàoshì — phòng học", example: "教室里有学生。Jiàoshì lǐ yǒu xuéshēng. (Trong phòng học có học sinh.)" },
      { front: "办公室", back: "bàngōngshì — văn phòng", example: "经理在办公室。Jīnglǐ zài bàngōngshì. (Giám đốc ở văn phòng.)" },
      { front: "房间", back: "fángjiān — căn phòng", example: "我的房间很干净。Wǒ de fángjiān hěn gānjìng. (Phòng tôi rất sạch.)" },
    ],
  },
  {
    slug: "hsk2-food",
    title: "HSK 2 — Food",
    titleVi: "HSK 2 — Đồ ăn",
    description: "Từ vựng về món ăn và thức uống.",
    language: "zh",
    cards: [
      { front: "米饭", back: "mǐfàn — cơm", example: "我喜欢吃米饭。Wǒ xǐhuān chī mǐfàn. (Tôi thích ăn cơm.)" },
      { front: "面条", back: "miàntiáo — mì sợi", example: "今天的面条很好吃。Jīntiān de miàntiáo hěn hǎochī. (Mì hôm nay rất ngon.)" },
      { front: "饺子", back: "jiǎozi — sủi cảo", example: "妈妈做饺子。Māma zuò jiǎozi. (Mẹ làm sủi cảo.)" },
      { front: "包子", back: "bāozi — bánh bao", example: "早上吃两个包子。Zǎoshang chī liǎng gè bāozi. (Buổi sáng ăn hai cái bánh bao.)" },
      { front: "鸡蛋", back: "jīdàn — trứng gà", example: "我每天吃一个鸡蛋。Wǒ měitiān chī yī gè jīdàn. (Tôi ăn một quả trứng mỗi ngày.)" },
      { front: "牛奶", back: "niúnǎi — sữa bò", example: "孩子喝牛奶。Háizi hē niúnǎi. (Trẻ con uống sữa.)" },
      { front: "茶", back: "chá — trà", example: "请喝茶。Qǐng hē chá. (Mời uống trà.)" },
      { front: "咖啡", back: "kāfēi — cà phê", example: "我每天喝咖啡。Wǒ měitiān hē kāfēi. (Mỗi ngày tôi uống cà phê.)" },
      { front: "水果", back: "shuǐguǒ — trái cây", example: "水果对身体好。Shuǐguǒ duì shēntǐ hǎo. (Trái cây tốt cho sức khỏe.)" },
      { front: "苹果", back: "píngguǒ — quả táo", example: "我喜欢吃苹果。Wǒ xǐhuān chī píngguǒ. (Tôi thích ăn táo.)" },
      { front: "鱼", back: "yú — cá", example: "晚饭有鱼。Wǎnfàn yǒu yú. (Bữa tối có cá.)" },
      { front: "肉", back: "ròu — thịt", example: "我不吃肉。Wǒ bù chī ròu. (Tôi không ăn thịt.)" },
      { front: "菜", back: "cài — món ăn / rau", example: "今天的菜很好吃。Jīntiān de cài hěn hǎochī. (Món hôm nay rất ngon.)" },
    ],
  },
  {
    slug: "hsk2-transport",
    title: "HSK 2 — Transport",
    titleVi: "HSK 2 — Giao thông",
    description: "Phương tiện đi lại và động từ liên quan.",
    language: "zh",
    cards: [
      { front: "车", back: "chē — xe", example: "我有一辆车。Wǒ yǒu yī liàng chē. (Tôi có một chiếc xe.)" },
      { front: "汽车", back: "qìchē — xe hơi", example: "汽车很贵。Qìchē hěn guì. (Xe hơi rất đắt.)" },
      { front: "出租车", back: "chūzūchē — taxi", example: "我们坐出租车。Wǒmen zuò chūzūchē. (Chúng tôi đi taxi.)" },
      { front: "公共汽车", back: "gōnggòng qìchē — xe buýt", example: "他坐公共汽车上学。Tā zuò gōnggòng qìchē shàngxué. (Anh ấy đi xe buýt đến trường.)" },
      { front: "地铁", back: "dìtiě — tàu điện ngầm", example: "北京有地铁。Běijīng yǒu dìtiě. (Bắc Kinh có tàu điện ngầm.)" },
      { front: "火车", back: "huǒchē — xe lửa", example: "火车快开了。Huǒchē kuài kāi le. (Xe lửa sắp khởi hành.)" },
      { front: "飞机", back: "fēijī — máy bay", example: "我坐飞机去上海。Wǒ zuò fēijī qù Shànghǎi. (Tôi đi máy bay đến Thượng Hải.)" },
      { front: "自行车", back: "zìxíngchē — xe đạp", example: "他骑自行车。Tā qí zìxíngchē. (Anh ấy đi xe đạp.)" },
      { front: "船", back: "chuán — thuyền/tàu", example: "船在海上。Chuán zài hǎi shàng. (Tàu đang ở trên biển.)" },
      { front: "坐", back: "zuò — ngồi / đi (bằng phương tiện)", example: "请坐。Qǐng zuò. (Mời ngồi.)" },
      { front: "开", back: "kāi — lái / mở", example: "我开车。Wǒ kāichē. (Tôi lái xe.)" },
      { front: "骑", back: "qí — cưỡi / đi (xe đạp/xe máy)", example: "他骑车上班。Tā qí chē shàngbān. (Anh ấy đi xe đến chỗ làm.)" },
    ],
  },

  // ============================================ HSK 3 (3 topics) ============================================
  {
    slug: "hsk3-emotions",
    title: "HSK 3 — Emotions",
    titleVi: "HSK 3 — Cảm xúc",
    description: "Diễn tả cảm xúc và trạng thái.",
    language: "zh",
    cards: [
      { front: "高兴", back: "gāoxìng — vui", example: "我很高兴见到你。Wǒ hěn gāoxìng jiàndào nǐ. (Tôi rất vui được gặp bạn.)" },
      { front: "快乐", back: "kuàilè — vui vẻ, hạnh phúc", example: "生日快乐！Shēngrì kuàilè! (Chúc mừng sinh nhật!)" },
      { front: "难过", back: "nánguò — buồn", example: "听到这个消息我很难过。Tīngdào zhège xiāoxī wǒ hěn nánguò. (Nghe tin này tôi rất buồn.)" },
      { front: "生气", back: "shēngqì — tức giận", example: "妈妈生气了。Māma shēngqì le. (Mẹ giận rồi.)" },
      { front: "担心", back: "dānxīn — lo lắng", example: "别担心，没事。Bié dānxīn, méishì. (Đừng lo, không sao đâu.)" },
      { front: "害怕", back: "hàipà — sợ hãi", example: "我害怕黑。Wǒ hàipà hēi. (Tôi sợ bóng tối.)" },
      { front: "兴奋", back: "xīngfèn — phấn khích", example: "孩子们很兴奋。Háizimen hěn xīngfèn. (Bọn trẻ rất phấn khích.)" },
      { front: "感动", back: "gǎndòng — cảm động", example: "她的故事让我感动。Tā de gùshì ràng wǒ gǎndòng. (Câu chuyện của cô ấy làm tôi cảm động.)" },
      { front: "紧张", back: "jǐnzhāng — căng thẳng", example: "考试前我很紧张。Kǎoshì qián wǒ hěn jǐnzhāng. (Trước kỳ thi tôi rất căng thẳng.)" },
      { front: "累", back: "lèi — mệt", example: "今天工作很累。Jīntiān gōngzuò hěn lèi. (Hôm nay làm việc rất mệt.)" },
      { front: "舒服", back: "shūfu — thoải mái / dễ chịu", example: "这把椅子很舒服。Zhè bǎ yǐzi hěn shūfu. (Cái ghế này rất thoải mái.)" },
      { front: "满意", back: "mǎnyì — hài lòng", example: "老板对我的工作很满意。Lǎobǎn duì wǒ de gōngzuò hěn mǎnyì. (Sếp rất hài lòng với công việc của tôi.)" },
      { front: "失望", back: "shīwàng — thất vọng", example: "他对结果很失望。Tā duì jiéguǒ hěn shīwàng. (Anh ấy rất thất vọng về kết quả.)" },
      { front: "感觉", back: "gǎnjué — cảm giác", example: "我感觉很好。Wǒ gǎnjué hěn hǎo. (Tôi cảm thấy rất tốt.)" },
      { front: "希望", back: "xīwàng — hy vọng", example: "我希望你成功。Wǒ xīwàng nǐ chénggōng. (Tôi mong bạn thành công.)" },
      { front: "笑", back: "xiào — cười", example: "他笑得很开心。Tā xiào de hěn kāixīn. (Anh ấy cười rất vui.)" },
      { front: "哭", back: "kū — khóc", example: "孩子哭了。Háizi kū le. (Đứa bé khóc rồi.)" },
      { front: "爱", back: "ài — yêu", example: "我爱我的家人。Wǒ ài wǒ de jiārén. (Tôi yêu gia đình của tôi.)" },
      { front: "讨厌", back: "tǎoyàn — ghét, chán", example: "我讨厌下雨。Wǒ tǎoyàn xià yǔ. (Tôi ghét trời mưa.)" },
      { front: "想念", back: "xiǎngniàn — nhớ", example: "我想念我的父母。Wǒ xiǎngniàn wǒ de fùmǔ. (Tôi nhớ bố mẹ.)" },
    ],
  },
  {
    slug: "hsk3-weather",
    title: "HSK 3 — Weather",
    titleVi: "HSK 3 — Thời tiết",
    description: "Từ vựng về thời tiết và các mùa.",
    language: "zh",
    cards: [
      { front: "天气", back: "tiānqì — thời tiết", example: "今天天气怎么样？Jīntiān tiānqì zěnmeyàng? (Hôm nay thời tiết thế nào?)" },
      { front: "晴", back: "qíng — nắng / quang đãng", example: "今天是晴天。Jīntiān shì qíng tiān. (Hôm nay trời nắng.)" },
      { front: "阴", back: "yīn — âm u", example: "天阴了。Tiān yīn le. (Trời âm u rồi.)" },
      { front: "雨", back: "yǔ — mưa", example: "外面下雨了。Wàimiàn xià yǔ le. (Bên ngoài đang mưa.)" },
      { front: "雪", back: "xuě — tuyết", example: "北京冬天下雪。Běijīng dōngtiān xià xuě. (Mùa đông Bắc Kinh có tuyết.)" },
      { front: "风", back: "fēng — gió", example: "今天风很大。Jīntiān fēng hěn dà. (Hôm nay gió rất to.)" },
      { front: "云", back: "yún — mây", example: "天上有很多云。Tiānshàng yǒu hěn duō yún. (Trên trời có rất nhiều mây.)" },
      { front: "热", back: "rè — nóng", example: "夏天很热。Xiàtiān hěn rè. (Mùa hè rất nóng.)" },
      { front: "冷", back: "lěng — lạnh", example: "今天冷不冷？Jīntiān lěng bù lěng? (Hôm nay có lạnh không?)" },
      { front: "暖和", back: "nuǎnhuo — ấm áp", example: "春天很暖和。Chūntiān hěn nuǎnhuo. (Mùa xuân rất ấm áp.)" },
      { front: "凉快", back: "liángkuai — mát mẻ", example: "秋天很凉快。Qiūtiān hěn liángkuai. (Mùa thu rất mát mẻ.)" },
      { front: "春天", back: "chūntiān — mùa xuân", example: "春天花开了。Chūntiān huā kāi le. (Mùa xuân hoa nở rồi.)" },
      { front: "夏天", back: "xiàtiān — mùa hè", example: "夏天去海边。Xiàtiān qù hǎibiān. (Mùa hè đi biển.)" },
      { front: "秋天", back: "qiūtiān — mùa thu", example: "秋天的树叶很美。Qiūtiān de shùyè hěn měi. (Lá cây mùa thu rất đẹp.)" },
      { front: "冬天", back: "dōngtiān — mùa đông", example: "冬天我喜欢喝热茶。Dōngtiān wǒ xǐhuān hē rè chá. (Mùa đông tôi thích uống trà nóng.)" },
      { front: "下雨", back: "xià yǔ — trời mưa", example: "明天会下雨。Míngtiān huì xià yǔ. (Ngày mai sẽ mưa.)" },
      { front: "下雪", back: "xià xuě — trời tuyết", example: "下雪了，孩子们很高兴。Xià xuě le, háizimen hěn gāoxìng. (Tuyết rơi rồi, bọn trẻ rất vui.)" },
      { front: "温度", back: "wēndù — nhiệt độ", example: "今天的温度是三十度。Jīntiān de wēndù shì sānshí dù. (Nhiệt độ hôm nay là 30 độ.)" },
    ],
  },
  {
    slug: "hsk3-shopping",
    title: "HSK 3 — Shopping",
    titleVi: "HSK 3 — Mua sắm",
    description: "Từ vựng dùng khi đi mua sắm.",
    language: "zh",
    cards: [
      { front: "钱", back: "qián — tiền", example: "这个多少钱？Zhège duōshao qián? (Cái này bao nhiêu tiền?)" },
      { front: "块", back: "kuài — tệ (đơn vị tiền nói)", example: "十块钱。Shí kuài qián. (Mười tệ.)" },
      { front: "元", back: "yuán — nguyên (đơn vị tiền chính thức)", example: "一百元。Yī bǎi yuán. (Một trăm nguyên.)" },
      { front: "便宜", back: "piányi — rẻ", example: "这家店很便宜。Zhè jiā diàn hěn piányi. (Cửa hàng này rất rẻ.)" },
      { front: "贵", back: "guì — đắt", example: "这件衣服太贵了。Zhè jiàn yīfu tài guì le. (Cái áo này đắt quá.)" },
      { front: "打折", back: "dǎzhé — giảm giá", example: "今天打八折。Jīntiān dǎ bā zhé. (Hôm nay giảm 20%.)" },
      { front: "商场", back: "shāngchǎng — trung tâm thương mại", example: "我们去商场吧。Wǒmen qù shāngchǎng ba. (Chúng ta đi trung tâm thương mại đi.)" },
      { front: "超市", back: "chāoshì — siêu thị", example: "超市离这儿很近。Chāoshì lí zhèr hěn jìn. (Siêu thị cách đây rất gần.)" },
      { front: "顾客", back: "gùkè — khách hàng", example: "顾客很多。Gùkè hěn duō. (Khách hàng rất đông.)" },
      { front: "服务员", back: "fúwùyuán — nhân viên phục vụ", example: "服务员，请来一下。Fúwùyuán, qǐng lái yīxià. (Nhân viên ơi, qua đây một chút.)" },
      { front: "衣服", back: "yīfu — quần áo", example: "我想买衣服。Wǒ xiǎng mǎi yīfu. (Tôi muốn mua quần áo.)" },
      { front: "鞋", back: "xié — giày", example: "这双鞋很舒服。Zhè shuāng xié hěn shūfu. (Đôi giày này rất thoải mái.)" },
      { front: "试", back: "shì — thử", example: "我能试一下吗？Wǒ néng shì yīxià ma? (Tôi thử được không?)" },
      { front: "付钱", back: "fùqián — trả tiền", example: "我用卡付钱。Wǒ yòng kǎ fùqián. (Tôi trả bằng thẻ.)" },
      { front: "信用卡", back: "xìnyòngkǎ — thẻ tín dụng", example: "可以刷信用卡吗？Kěyǐ shuā xìnyòngkǎ ma? (Có thể quẹt thẻ tín dụng không?)" },
      { front: "现金", back: "xiànjīn — tiền mặt", example: "我只有现金。Wǒ zhǐyǒu xiànjīn. (Tôi chỉ có tiền mặt.)" },
      { front: "礼物", back: "lǐwù — quà tặng", example: "这是给你的礼物。Zhè shì gěi nǐ de lǐwù. (Đây là quà cho bạn.)" },
      { front: "包", back: "bāo — túi, bao", example: "这个包多少钱？Zhège bāo duōshao qián? (Cái túi này bao nhiêu tiền?)" },
      { front: "选", back: "xuǎn — chọn", example: "我选这个颜色。Wǒ xuǎn zhège yánsè. (Tôi chọn màu này.)" },
      { front: "找", back: "zhǎo — tìm / trả lại tiền", example: "找您五块。Zhǎo nín wǔ kuài. (Trả lại bạn năm tệ.)" },
    ],
  },
];

// =========================================================================================
// Reading exercises.
// =========================================================================================

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
  language: Language;
  questions: SeedQuestion[];
}

const englishExercises: SeedExercise[] = [
  {
    slug: "city-life",
    title: "City Life",
    level: "beginner",
    language: "en",
    passage:
      "Living in a big city has many advantages. Cities offer a wide range of jobs, so people can find work in many different fields. Public transportation, such as buses and trains, makes it easy to travel without a car. There are also many restaurants, museums, and parks to enjoy. However, city life can be expensive. Rent is often high, and the streets can be crowded and noisy. Despite these challenges, many people choose to live in cities because of the opportunities and excitement they offer.",
    questions: [
      { prompt: "What does the passage mainly discuss?", options: ["City life", "Farming", "Weather", "Sports"], correctIndex: 0 },
      { prompt: "Which is mentioned as an advantage of cities?", options: ["Quiet streets", "Many jobs", "Clean air", "Cheap rent"], correctIndex: 1 },
      { prompt: "How can people travel in the city without a car?", options: ["By plane", "By boat", "By public transportation", "By bicycle only"], correctIndex: 2 },
      { prompt: "What is one disadvantage of city life mentioned?", options: ["No restaurants", "Few jobs", "High rent", "No parks"], correctIndex: 2 },
      { prompt: "Why do many people still choose to live in cities?", options: ["Because it is cheap", "Because of the opportunities and excitement", "Because it is quiet", "Because there are no challenges"], correctIndex: 1 },
    ],
  },
  {
    slug: "morning-routine",
    title: "A Morning Routine",
    level: "beginner",
    language: "en",
    passage:
      "Anna wakes up at six o'clock every morning. First, she drinks a glass of water and stretches for a few minutes. Then she goes for a short run in the park near her house. After her run, she takes a shower and prepares a healthy breakfast, usually eggs and fruit. By seven thirty, she is ready for work. Anna believes that a calm and active morning helps her feel focused for the rest of the day.",
    questions: [
      { prompt: "What time does Anna wake up?", options: ["Five o'clock", "Six o'clock", "Seven o'clock", "Eight o'clock"], correctIndex: 1 },
      { prompt: "What does Anna do first after waking up?", options: ["Goes for a run", "Takes a shower", "Drinks water and stretches", "Eats breakfast"], correctIndex: 2 },
      { prompt: "Where does Anna run?", options: ["On a treadmill", "In the park", "On the beach", "At the gym"], correctIndex: 1 },
      { prompt: "What does Anna usually eat for breakfast?", options: ["Eggs and fruit", "Toast and coffee", "Cereal", "Nothing"], correctIndex: 0 },
    ],
  },
  {
    slug: "the-job-interview",
    title: "The Job Interview",
    level: "intermediate",
    language: "en",
    passage:
      "Preparing for a job interview can reduce stress and improve your chances of success. Before the interview, research the company so you understand its products and values. Practice answering common questions, such as describing your strengths and weaknesses. Dress professionally and arrive at least ten minutes early. During the interview, listen carefully and answer clearly. At the end, it is a good idea to ask a thoughtful question about the role. Sending a short thank-you email afterward can also leave a positive impression.",
    questions: [
      { prompt: "What is the main purpose of the passage?", options: ["To describe a company", "To give advice on job interviews", "To explain how to write emails", "To list common jobs"], correctIndex: 1 },
      { prompt: "What should you do before the interview?", options: ["Research the company", "Arrive late", "Avoid practicing", "Wear casual clothes"], correctIndex: 0 },
      { prompt: "How early should you arrive?", options: ["At the exact time", "Ten minutes early", "One hour early", "Five minutes late"], correctIndex: 1 },
      { prompt: "What is suggested to do at the end of the interview?", options: ["Leave immediately", "Ask a thoughtful question", "Criticize the company", "Request the salary first"], correctIndex: 1 },
      { prompt: "What can leave a positive impression after the interview?", options: ["Calling many times", "Sending a thank-you email", "Doing nothing", "Visiting the office again"], correctIndex: 1 },
    ],
  },
];

// v6 — HSK 2-3 short reading passages. Passage shown in Hán tự; questions in Vietnamese.
const chineseExercises: SeedExercise[] = [
  {
    slug: "zh-my-family",
    title: "我的家 (Gia đình tôi)",
    level: "HSK 2",
    language: "zh",
    passage:
      "我家有五个人：爸爸、妈妈、哥哥、妹妹和我。爸爸是医生，妈妈是老师。哥哥今年二十岁，他在大学学习。妹妹只有八岁，她喜欢画画。我每天和家人一起吃晚饭。星期天我们常常去公园。我很爱我的家。",
    questions: [
      { prompt: "Gia đình tôi có bao nhiêu người?", options: ["Bốn người", "Năm người", "Sáu người", "Bảy người"], correctIndex: 1 },
      { prompt: "Mẹ tôi làm nghề gì?", options: ["Bác sĩ", "Giáo viên", "Học sinh", "Họa sĩ"], correctIndex: 1 },
      { prompt: "Anh trai tôi bao nhiêu tuổi?", options: ["18 tuổi", "20 tuổi", "22 tuổi", "8 tuổi"], correctIndex: 1 },
      { prompt: "Em gái tôi thích làm gì?", options: ["Hát", "Đọc sách", "Vẽ tranh", "Chơi bóng"], correctIndex: 2 },
      { prompt: "Chủ nhật gia đình thường đi đâu?", options: ["Đi học", "Đi siêu thị", "Đi công viên", "Đi bệnh viện"], correctIndex: 2 },
    ],
  },
  {
    slug: "zh-weather-today",
    title: "今天的天气 (Thời tiết hôm nay)",
    level: "HSK 2",
    language: "zh",
    passage:
      "今天是星期六，天气很好。早上有点冷，下午很暖和。天上没有云，阳光很大。我和朋友一起去公园。我们在公园里走了一个小时。然后我们去咖啡店喝咖啡。晚上回家的时候，开始下雨了。明天可能也会下雨。",
    questions: [
      { prompt: "Hôm nay là thứ mấy?", options: ["Thứ Sáu", "Thứ Bảy", "Chủ nhật", "Thứ Hai"], correctIndex: 1 },
      { prompt: "Buổi sáng thời tiết thế nào?", options: ["Rất nóng", "Hơi lạnh", "Có tuyết", "Có gió to"], correctIndex: 1 },
      { prompt: "Họ đi đâu trước?", options: ["Đi siêu thị", "Đi công viên", "Đi quán cà phê", "Đi nhà bạn"], correctIndex: 1 },
      { prompt: "Họ đi dạo trong công viên bao lâu?", options: ["30 phút", "1 tiếng", "2 tiếng", "3 tiếng"], correctIndex: 1 },
      { prompt: "Buổi tối khi về nhà thì sao?", options: ["Trời nắng", "Bắt đầu mưa", "Có tuyết", "Có sương mù"], correctIndex: 1 },
    ],
  },
  {
    slug: "zh-shopping-trip",
    title: "去商场 (Đi trung tâm thương mại)",
    level: "HSK 3",
    language: "zh",
    passage:
      "上个周末，我和姐姐去商场买东西。姐姐想买一件红色的衣服。我们看了很多商店，最后在一家小店找到了。那件衣服本来要四百块，但是打八折，所以只要三百二十块。姐姐很高兴。然后我也买了一双新鞋，花了两百块。我们用现金付钱。逛了三个小时以后，我们都很累，就在商场里的饭店吃了晚饭。",
    questions: [
      { prompt: "Họ đi mua sắm khi nào?", options: ["Hôm nay", "Hôm qua", "Cuối tuần trước", "Tuần tới"], correctIndex: 2 },
      { prompt: "Chị gái muốn mua gì?", options: ["Một đôi giày", "Một cái áo màu đỏ", "Một cái túi", "Một cuốn sách"], correctIndex: 1 },
      { prompt: "Cái áo giảm giá còn bao nhiêu tiền?", options: ["400 tệ", "320 tệ", "200 tệ", "280 tệ"], correctIndex: 1 },
      { prompt: "Tôi mua gì?", options: ["Một cái áo", "Một đôi giày mới", "Một cái túi", "Không mua gì cả"], correctIndex: 1 },
      { prompt: "Họ trả tiền bằng cách nào?", options: ["Thẻ tín dụng", "Tiền mặt", "Chuyển khoản", "Trả góp"], correctIndex: 1 },
    ],
  },
];

// =========================================================================================
// Vocabulary seed for the demo user — keeps the English v2 seed and adds a tiny zh sample.
// =========================================================================================

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
  pinyin?: string;
  hskLevel?: number;
  language: Language;
  isFavorite?: boolean;
  known?: boolean;
}

const vocabSeed: SeedVocab[] = [
  // ---------- English ----------
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
    language: "en",
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
    language: "en",
    known: true,
  },
  {
    word: "commute",
    meaning: "việc đi lại (đi làm)",
    partOfSpeech: "noun",
    tags: ["daily-life"],
    cefrLevel: "B1",
    language: "en",
  },
  // ---------- Chinese ----------
  {
    word: "朋友",
    meaning: "bạn bè",
    pinyin: "péngyǒu",
    partOfSpeech: "noun",
    exampleSentence: "他是我最好的朋友。Tā shì wǒ zuì hǎo de péngyǒu. (Anh ấy là bạn thân nhất của tôi.)",
    tags: ["HSK1"],
    hskLevel: 1,
    language: "zh",
    isFavorite: true,
  },
  {
    word: "学习",
    meaning: "học tập",
    pinyin: "xuéxí",
    partOfSpeech: "verb",
    exampleSentence: "我每天学习汉语。Wǒ měitiān xuéxí Hànyǔ. (Mỗi ngày tôi học tiếng Trung.)",
    tags: ["HSK1"],
    hskLevel: 1,
    language: "zh",
  },
];

// =========================================================================================
// Main.
// =========================================================================================

async function main() {
  // Demo user (idempotent). Pre-set language to "en" so the v1 demo continues to "just work";
  // brand-new users registering through the API still get language=null and are funnelled through
  // the /choose-language gate.
  const passwordHash = await bcrypt.hash("secret123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: { language: "en" },
    create: {
      email: "demo@example.com",
      name: "Demo Learner",
      passwordHash,
      language: "en",
    },
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
        cefrLevel: v.language === "en" ? v.cefrLevel ?? null : null,
        pinyin: v.language === "zh" ? v.pinyin ?? null : null,
        hskLevel: v.language === "zh" ? v.hskLevel ?? null : null,
        language: v.language,
        isFavorite: v.isFavorite ?? false,
        known: v.known ?? false,
      })),
    });
  }

  // Topics + flashcards across both languages.
  const allTopics = [...englishTopics, ...chineseTopics];
  for (const [tIndex, t] of allTopics.entries()) {
    const topic = await prisma.topic.upsert({
      where: { slug_language: { slug: t.slug, language: t.language } },
      update: {
        title: t.title,
        titleVi: t.titleVi,
        description: t.description,
        order: tIndex,
        language: t.language,
      },
      create: {
        slug: t.slug,
        title: t.title,
        titleVi: t.titleVi,
        description: t.description,
        order: tIndex,
        language: t.language,
      },
    });

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

  // Reading exercises + questions across both languages.
  const allExercises = [...englishExercises, ...chineseExercises];
  for (const [eIndex, e] of allExercises.entries()) {
    const exercise = await prisma.readingExercise.upsert({
      where: { slug_language: { slug: e.slug, language: e.language } },
      update: {
        title: e.title,
        level: e.level,
        passage: e.passage,
        order: eIndex,
        language: e.language,
      },
      create: {
        slug: e.slug,
        title: e.title,
        level: e.level,
        passage: e.passage,
        order: eIndex,
        language: e.language,
      },
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

  // Admin user (idempotent). Language defaults to "en" so admin can browse content.
  const adminHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@elearning.com" },
    update: { language: "en" },
    create: {
      email: "admin@elearning.com",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
      language: "en",
    },
  });

  const englishCardCount = englishTopics.reduce((a, t) => a + t.cards.length, 0);
  const chineseCardCount = chineseTopics.reduce((a, t) => a + t.cards.length, 0);

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${englishTopics.length} EN topics (${englishCardCount} cards) + ${chineseTopics.length} ZH topics (${chineseCardCount} cards), ` +
      `${englishExercises.length} EN reading exercises + ${chineseExercises.length} ZH reading exercises, ` +
      `${vocabSeed.length} vocabulary entries (if empty), ` +
      `demo user (demo@example.com / secret123, language=en), ` +
      `admin user (admin@elearning.com / Admin@123, language=en).`
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
