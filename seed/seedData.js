require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Category, Recipe } = require('../models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cookflow_db';

const CATEGORIES_DATA = [
  { name: 'Món nhanh ⚡', slug: 'mon-nhanh', icon: '⚡', order: 1 },
  { name: 'Món chính 🍲', slug: 'mon-chinh', icon: '🍲', order: 2 },
  { name: 'Ăn kiêng 🥗', slug: 'an-kieng', icon: '🥗', order: 3 },
  { name: 'Tráng miệng 🍰', slug: 'trang-mieng', icon: '🍰', order: 4 },
  { name: 'Thức uống 🍹', slug: 'thuc-uong', icon: '🍹', order: 5 }
];

const RAW_RECIPES = [
  {
    title: 'Trứng Ngâm Tương Lòng Đào',
    description: 'Trứng dẻo thơm ngâm trong xốt tương ngọt thanh pha hành tỏi ớt, chuẩn vị cơm nhà Hàn Quốc.',
    imageUrl: 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    categoryName: 'Món nhanh ⚡',
    prepTimeMinutes: 10,
    cookTimeMinutes: 6,
    servings: 4,
    calories: 145,
    difficulty: 'Dễ',
    colorAccent: '#FFD43B',
    ingredients: [
      { name: 'Trứng gà ta', amount: '6', unit: 'quả', group: 'Nguyên liệu chính' },
      { name: 'Nước tương ngon', amount: '150', unit: 'ml', group: 'Nước xốt' },
      { name: 'Nước lọc', amount: '150', unit: 'ml', group: 'Nước xốt' },
      { name: 'Đường phèn hoặc mật ong', amount: '2', unit: 'muỗng canh', group: 'Nước xốt' },
      { name: 'Hành boaro, tỏi, ớt sừng', amount: 'Vừa đủ', unit: 'phần', group: 'Rau thơm' },
      { name: 'Mè trắng rang thơm', amount: '1', unit: 'muỗng cà phê', group: 'Trang trí' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Nấu nước tương xốt thần thánh 🥣',
        instruction: 'Hòa tan nước tương, nước lọc và đường vào nồi nhỏ. Đun lửa vừa cho sôi lăn tăn rồi tắt bếp để nguội hẳn.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        timerSeconds: 180,
        tip: 'Phải đợi nước tương nguội hẳn mới cho trứng vào để không làm chín thêm lòng đỏ nhé!'
      },
      {
        stepNumber: 2,
        title: 'Luộc trứng lòng đào dẻo quánh ⏱️',
        instruction: 'Đun sôi một nồi nước với 1 muỗng giấm và chút muối. Dùng muôi thả từng quả trứng vào, khuấy nhẹ vòng tròn.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        timerSeconds: 360,
        tip: 'Canh chuẩn đúng 6 phút để có lòng đào chảy dẻo siêu ngon!'
      },
      {
        stepNumber: 3,
        title: 'Hạ nhiệt tức thì trong âu nước đá 🧊',
        instruction: 'Vớt trứng ra ngay lập tức và thả vào âu nước đá lạnh ngập trứng. Để yên 5 phút rồi bóc vỏ.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 300,
        tip: 'Nước đá lạnh giúp sốc nhiệt, vỏ trứng sẽ tróc ra cực kỳ dễ dàng.'
      },
      {
        stepNumber: 4,
        title: 'Xếp trứng & Thưởng thức 🍯',
        instruction: 'Xếp trứng vào hộp thủy tinh, đổ ngập nước tương đã nguội, thêm hành tỏi ớt băm và rắc mè rang. Đậy kín cất ngăn mát 6 tiếng là ăn được!',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        timerSeconds: null
      }
    ]
  },
  {
    title: 'Sườn Non Rim Chua Ngọt Óng Ánh',
    description: 'Từng miếng sườn đẫm xốt sánh quyện, vị chua dịu của giấm táo hòa cùng vị ngọt đậm đà bắt cơm.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    categoryName: 'Món chính 🍲',
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    servings: 3,
    calories: 420,
    difficulty: 'Vừa',
    colorAccent: '#FF6B6B',
    ingredients: [
      { name: 'Sườn thăn heo non', amount: '500', unit: 'gram', group: 'Nguyên liệu chính' },
      { name: 'Cà chua chín mọng', amount: '2', unit: 'quả', group: 'Nguyên liệu chính' },
      { name: 'Giấm táo & Đường thốt nốt', amount: '3', unit: 'muỗng canh', group: 'Nước xốt' },
      { name: 'Nước mắm truyền thống', amount: '2', unit: 'muỗng canh', group: 'Nước xốt' },
      { name: 'Hành khô, tỏi tím băm', amount: '2', unit: 'củ', group: 'Gia vị' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Chần sơ khử mùi sườn 🍲',
        instruction: 'Chặt sườn miếng vừa ăn 3cm. Đun sôi nước với nhánh gừng đập dập, chần sườn trong 3 phút rồi rửa sạch lại bằng nước ấm.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        timerSeconds: 180
      },
      {
        stepNumber: 2,
        title: 'Ướp sườn ngấm sâu gia vị 🧂',
        instruction: 'Ướp sườn với 1 thìa nước mắm, hành tỏi băm và hạt tiêu xay. Để sườn nghỉ cho thấm đều.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 900,
        tip: 'Ướp đủ 15 phút giúp thịt ngọt đậm đà từ bên trong xương.'
      },
      {
        stepNumber: 3,
        title: 'Áp chảo xém vàng cạnh 🍳',
        instruction: 'Đun nóng 1 thìa dầu ăn, xếp sườn vào áp chảo với lửa vừa cho đến khi hai mặt sườn chuyển màu vàng ruộm hấp dẫn.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        timerSeconds: 300
      },
      {
        stepNumber: 4,
        title: 'Om xốt chua ngọt keo óng ✨',
        instruction: 'Đổ bát nước xốt chua ngọt vào chảo. Đậy nắp rim lửa nhỏ cho thịt mềm và nước xốt keo lại bao quanh sườn.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        timerSeconds: 600
      }
    ]
  },
  {
    title: 'Salad Bơ Ức Gà Xốt Mè Rang',
    description: 'Món ăn thanh mát giàu protein, ức gà mềm mọng nước không hề bị khô kết hợp bơ béo bùi.',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    categoryName: 'Ăn kiêng 🥗',
    prepTimeMinutes: 10,
    cookTimeMinutes: 8,
    servings: 2,
    calories: 280,
    difficulty: 'Dễ',
    colorAccent: '#38D9A9',
    ingredients: [
      { name: 'Ức gà phi lê', amount: '250', unit: 'gram', group: 'Nguyên liệu chính' },
      { name: 'Quả bơ sáp chín', amount: '1', unit: 'quả', group: 'Nguyên liệu chính' },
      { name: 'Xà lách Romaine, cà chua bi', amount: '150', unit: 'gram', group: 'Rau thơm' },
      { name: 'Xốt mè rang Nhật Bản', amount: '3', unit: 'muỗng canh', group: 'Nước xốt' },
      { name: 'Muối hồng, tiêu đen, dầu olive', amount: 'Vừa đủ', unit: 'phần', group: 'Gia vị' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Ướp ức gà kiểu Địa Trung Hải 🌿',
        instruction: 'Khứa nhẹ vài đường trên ức gà, rắc muối hồng, tiêu đen và thoa đều 1 thìa dầu olive trong 5 phút.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 300
      },
      {
        stepNumber: 2,
        title: 'Áp chảo ức gà mọng nước 🍗',
        instruction: 'Làm nóng chảo, áp chảo mỗi mặt 4 phút ở lửa vừa. Đậy vung 1 phút cuối để thịt chín đều mà không bị khô.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        timerSeconds: 480,
        tip: 'Để ức gà nghỉ 3 phút trước khi thái lát mỏng để nước ngọt không bị chảy ra ngoài.'
      },
      {
        stepNumber: 3,
        title: 'Bày đĩa & Rưới xốt mè rang 🥑',
        instruction: 'Cắt lát bơ và ức gà. Xếp rau xà lách, cà chua bi xung quanh đĩa, rưới xốt mè rang và thưởng thức ngay!',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        timerSeconds: null
      }
    ]
  },
  {
    title: 'Bò Bít Tết Áp Chảo Bơ Tỏi Thảo Mộc',
    description: 'Thăn bò mềm tan thơm nức mùi bơ lạt và lá hương thảo, chuẩn phong cách nhà hàng cao cấp.',
    imageUrl: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    categoryName: 'Món chính 🍲',
    prepTimeMinutes: 10,
    cookTimeMinutes: 6,
    servings: 2,
    calories: 520,
    difficulty: 'Khó',
    colorAccent: '#FFA94D',
    ingredients: [
      { name: 'Thăn bò Úc (Ribeye)', amount: '300', unit: 'gram', group: 'Nguyên liệu chính' },
      { name: 'Bơ lạt nguyên chất', amount: '30', unit: 'gram', group: 'Gia vị' },
      { name: 'Lá hương thảo (Rosemary)', amount: '2', unit: 'nhánh', group: 'Rau thơm' },
      { name: 'Tỏi tép nguyên vỏ đập dập', amount: '4', unit: 'tép', group: 'Rau thơm' },
      { name: 'Muối hạt, tiêu đen đập dập', amount: 'Vừa đủ', unit: 'phần', group: 'Gia vị' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Thấm khô & Ướp muối tiêu 🥩',
        instruction: 'Dùng khăn giấy thấm thật khô 2 mặt miếng bò. Rắc đều muối hạt và tiêu đen đập dập lên bề mặt.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 300
      },
      {
        stepNumber: 2,
        title: 'Áp chảo lửa lớn tạo viền nâu giòn ♨️',
        instruction: 'Cho chảo thật nóng bốc khói nhẹ, đổ dầu ăn vào. Áp chảo mặt thứ nhất 2 phút, lật mặt áp chảo tiếp 2 phút.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        timerSeconds: 240
      },
      {
        stepNumber: 3,
        title: 'Rưới bơ thảo mộc thơm lừng (Basting) 🧈',
        instruction: 'Hạ lửa, cho bơ lạt, nhánh hương thảo và tỏi vào chảo. Nghiêng chảo, dùng muỗng liên tục múc bơ tan chảy rưới đều lên miếng thịt.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        timerSeconds: 120
      },
      {
        stepNumber: 4,
        title: 'Để thịt nghỉ giữ nước mọng (Resting) ⏳',
        instruction: 'Gắp miếng bò ra thớt gỗ, để yên đúng 5 phút để các thớ thịt ngậm lại nước ngọt trước khi cắt lát.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        timerSeconds: 300,
        tip: 'Đừng cắt ngay nhé! Cắt ngay miếng thịt sẽ bị chảy hết nước ngọt ra ngoài.'
      }
    ]
  },
  {
    title: 'Trà Đào Cam Sả Mát Lạnh Sảng Khoái',
    description: 'Hương thơm nồng nàn từ sả tươi, vị chua thanh của cam vàng và những miếng đào giòn ngọt lịm.',
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    categoryName: 'Thức uống 🍹',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    calories: 120,
    difficulty: 'Dễ',
    colorAccent: '#FF922B',
    ingredients: [
      { name: 'Trà túi lọc hương đào', amount: '2', unit: 'gói', group: 'Nguyên liệu chính' },
      { name: 'Sả tươi đập dập', amount: '3', unit: 'cây', group: 'Nguyên liệu chính' },
      { name: 'Cam vàng cắt lát', amount: '1', unit: 'quả', group: 'Nguyên liệu chính' },
      { name: 'Đào ngâm giòn', amount: '4', unit: 'miếng', group: 'Trang trí' },
      { name: 'Siro đào & Đường mía', amount: '30', unit: 'ml', group: 'Nước xốt' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Đun nước sả thơm ngát 🌿',
        instruction: 'Cắt khúc sả tươi đập dập, cho vào nồi cùng 400ml nước, đun sôi lăn tăn trong 5 phút để ra hết tinh dầu sả.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        timerSeconds: 300
      },
      {
        stepNumber: 2,
        title: 'Ủ trà đào đậm vị 🍵',
        instruction: 'Tắt bếp, thả 2 gói trà đào vào nước sả nóng. Đậy nắp ủ trà trong 5 phút rồi vớt túi lọc ra.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 300
      },
      {
        stepNumber: 3,
        title: 'Pha chế cùng cam tươi và đá lạnh 🍊',
        instruction: 'Vắt nước nửa quả cam vào ly, thêm siro đào, rót trà đã nguội vào khuấy đều. Thêm đầy đá viên và xếp đào ngâm lên trên.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        timerSeconds: null
      }
    ]
  },
  {
    title: 'Pudding Xoài Sữa Dừa Mềm Mịn',
    description: 'Món tráng miệng vàng óng núng nính, vị béo thơm của cốt dừa quyện cùng vị ngọt lịm tự nhiên của xoài cát.',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    categoryName: 'Tráng miệng 🍰',
    prepTimeMinutes: 15,
    cookTimeMinutes: 5,
    servings: 4,
    calories: 190,
    difficulty: 'Dễ',
    colorAccent: '#FCC419',
    ingredients: [
      { name: 'Xoài cát chín ngọt', amount: '2', unit: 'quả', group: 'Nguyên liệu chính' },
      { name: 'Nước cốt dừa béo', amount: '150', unit: 'ml', group: 'Nguyên liệu chính' },
      { name: 'Sữa tươi không đường', amount: '150', unit: 'ml', group: 'Nguyên liệu chính' },
      { name: 'Bột Gelatin', amount: '10', unit: 'gram', group: 'Gia vị' },
      { name: 'Đường phèn xay', amount: '40', unit: 'gram', group: 'Gia vị' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Ngâm nở gelatin 💧',
        instruction: 'Hòa bột gelatin vào 30ml nước lạnh, để yên 10 phút cho bột ngậm nước nở đều.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        timerSeconds: 600
      },
      {
        stepNumber: 2,
        title: 'Nấu hỗn hợp sữa dừa ấm nóng 🥥',
        instruction: 'Khuấy đều sữa tươi, cốt dừa và đường trên lửa nhỏ vừa ấm (không để sôi bùng). Cho gelatin đã nở vào khuấy tan.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        timerSeconds: 180
      },
      {
        stepNumber: 3,
        title: 'Xay nhuyễn xoài & Đổ khuôn xinh xắn 🥭',
        instruction: 'Xay nhuyễn 1 quả xoài rồi trộn vào hỗn hợp sữa dừa. Rót vào từng ly nhỏ, bảo quản ngăn mát 2 tiếng cho đông mềm.',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        timerSeconds: null
      }
    ]
  }
];

async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('[Seed] Connected successfully.');

    // 1. Seed Users
    console.log('[Seed] Seeding Users...');
    const hashedPass = await bcrypt.hash('123456', 10);

    let admin = await User.findOne({ email: 'admin@cookflow.com' });
    if (!admin) {
      admin = await User.create({
        username: 'admin',
        email: 'admin@cookflow.com',
        password: hashedPass,
        fullName: 'Quản Trị Viên CookFlow',
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
      });
      console.log('  -> Created Admin: admin@cookflow.com / 123456');
    } else {
      console.log('  -> Admin already exists.');
    }

    let chef = await User.findOne({ email: 'chef@cookflow.com' });
    if (!chef) {
      chef = await User.create({
        username: 'chef',
        email: 'chef@cookflow.com',
        password: hashedPass,
        fullName: 'Bếp Trưởng CookFlow',
        role: 'user',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
      });
      console.log('  -> Created Chef user: chef@cookflow.com / 123456');
    } else {
      console.log('  -> Chef user already exists.');
    }

    // 2. Seed Categories
    console.log('[Seed] Seeding Categories...');
    const categoryMap = {};
    for (const cat of CATEGORIES_DATA) {
      let existingCat = await Category.findOne({ slug: cat.slug });
      if (!existingCat) {
        existingCat = await Category.create(cat);
        console.log(`  -> Created Category: ${cat.name}`);
      }
      categoryMap[cat.name] = existingCat._id;
    }

    // 3. Seed Recipes
    console.log('[Seed] Seeding Recipes...');
    for (const item of RAW_RECIPES) {
      const categoryId = categoryMap[item.categoryName];
      if (!categoryId) {
        console.warn(`  -> Warning: Category not found for ${item.categoryName}`);
        continue;
      }

      const existingRecipe = await Recipe.findOne({ title: item.title });
      if (!existingRecipe) {
        await Recipe.create({
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
          videoUrl: item.videoUrl,
          category: categoryId,
          author: admin._id,
          prepTimeMinutes: item.prepTimeMinutes,
          cookTimeMinutes: item.cookTimeMinutes,
          servings: item.servings,
          calories: item.calories,
          difficulty: item.difficulty,
          colorAccent: item.colorAccent,
          isCustom: false,
          isPublic: true,
          ingredients: item.ingredients,
          steps: item.steps,
          likesCount: 12
        });
        console.log(`  -> Created Recipe: ${item.title}`);
      } else {
        console.log(`  -> Recipe already exists: ${item.title}`);
      }
    }

    console.log('[Seed] Seeding completed successfully! 🌟');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
}

seed();
