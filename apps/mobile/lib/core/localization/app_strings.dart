/// All user-facing copy is Uzbek. Held in one place so the UZ/RU switch in
/// Prompt 17 has a single seam to work against.
abstract final class AppStrings {
  static const String appName = 'Agromagnat';
  static const String tagline = "Yerdan dasturxongacha — vositachisiz";

  // Bottom navigation
  static const String navHome = 'Bosh';
  static const String navSearch = 'Qidiruv';
  static const String navAdd = "E'lon joylash";
  static const String navMessages = 'Xabarlar';
  static const String navProfile = 'Profil';

  // Screens still to be built.
  static const String comingSoon = 'Tez orada';
  static const String homeTitle = 'Bosh sahifa';
  static const String searchTitle = 'Qidiruv';
  static const String addTitle = "E'lon joylash";
  static const String messagesTitle = 'Xabarlar';
  static const String profileTitle = 'Profil';

  // Home
  static const String categories = 'Kategoriyalar';
  static const String allCategories = 'Barchasi';
  static const String latestListings = "So'nggi e'lonlar";
  static const String seeAll = "Hammasi";
  static const String searchHint = "Mahsulot yoki joy nomi";

  // Listing card and detail
  static const String topBadge = 'TOP';
  static const String verified = 'Tasdiqlangan';
  static const String minOrder = 'Eng kam partiya';
  static const String harvestDate = "Yig'im sanasi";
  static const String delivery = 'Yetkazib berish';
  static const String totalValue = "Umumiy qiymati";
  static const String descriptionTitle = 'Tavsif';
  static const String sellerTitle = 'Sotuvchi';
  static const String callSeller = "Qo'ng'iroq qilish";
  static const String writeMessage = 'Yozish';
  static const String addToFavorites = 'Saqlash';
  static const String removeFromFavorites = 'Saqlanganlardan olish';
  static const String views = "ko'rildi";
  static const String expiresIn = 'Amal qilish muddati';
  static const String daysShort = 'kun';
  static const String salesCount = 'sotuv';

  // Search and filters
  static const String filters = 'Filtrlar';
  static const String apply = "Qo'llash";
  static const String reset = 'Tozalash';
  static const String sortTitle = 'Saralash';
  static const String sortNewest = 'Yangilari';
  static const String sortPriceAsc = 'Arzonlari';
  static const String sortPriceDesc = 'Qimmatlari';
  static const String region = 'Viloyat';
  static const String district = 'Tuman';
  static const String category = 'Kategoriya';
  static const String priceRange = 'Narx oralig‘i';
  static const String anyRegion = 'Barcha viloyatlar';
  static const String anyDistrict = 'Barcha tumanlar';
  static const String anyCategory = 'Barcha kategoriyalar';
  static const String priceFrom = 'dan';
  static const String priceTo = 'gacha';

  // States
  static const String loading = 'Yuklanmoqda…';
  static const String nothingFound = "Hech narsa topilmadi";
  static const String nothingFoundHint =
      "Filtrlarni o'zgartirib yoki boshqa so'z bilan qidirib ko'ring";
  static const String loadFailed = "Ma'lumot yuklanmadi";
  static const String loadFailedHint = "Internetni tekshirib, qayta urinib ko'ring";
  static const String retry = "Qayta urinish";
  static const String listingNotFound = "E'lon topilmadi";
  static const String listingNotFoundHint =
      "E'lon o'chirilgan yoki muddati tugagan bo'lishi mumkin";

  // Sign-in
  static const String signInTitle = 'Kirish';
  static const String signInHeadline = 'Telefon raqamingiz';
  static const String signInHint =
      "Raqamingizga 6 xonali kod yuboramiz. Parol kerak emas.";
  static const String sendCode = 'Kod yuborish';
  static const String codeHeadline = 'Kodni kiriting';
  static const String codeSentTo = 'Kod yuborildi:';
  static const String signIn = 'Kirish';
  static const String changeNumber = "Raqamni o'zgartirish";
  static const String resendCode = 'Qayta yuborish';
  static const String resendIn = 'Qayta yuborish';
  static const String tryAgainIn = 'Qayta urinish';
  static const String devCodeHint = 'Sinov rejimi — kod:';
  static const String signInTerms =
      "Kirish orqali foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz";
  static const String signOut = 'Chiqish';
  static const String signOutConfirm = 'Hisobdan chiqasizmi?';
  static const String cancel = 'Bekor qilish';

  // Sign-in wall
  static const String signInRequired = 'Buning uchun kirish kerak';
  static const String signInRequiredFavorites =
      "Saqlangan e'lonlar hisobingizga bog'lanadi";
  static const String signInRequiredAdd =
      "E'lon joylash uchun telefon raqamingizni tasdiqlang";
  static const String signInRequiredProfile =
      "Profilingizni ko'rish uchun kiring";
  static const String signInRequiredMessages =
      'Xabarlashish uchun kiring';

  // Offline
  static const String offlineTitle = 'Internet yo‘q';
  static const String offlineRetry = 'Yangilash';

  // Outbox
  static const String queuedTitle = "E'lon navbatda";
  static const String queuedHint =
      "Internet paydo bo'lishi bilan o'zi joylanadi. Ilovani yopsangiz ham saqlanadi.";
  static const String sendNow = 'Hozir yuborish';
  static const String sending = 'Yuborilmoqda…';
  static const String discardQueued = "O'chirish";
  static const String queuedStuckHint =
      "Bu e'lonni server qabul qilmadi. Uni o'chirib, qaytadan joylang.";
  static const String discardQueuedTitle = "E'lonni o'chirasizmi?";

  // My listings
  static const String myListingsTitle = "Mening e'lonlarim";
  static const String myListingsEmpty = "Hali e'lon joylamagansiz";
  static const String myListingsEmptyHint =
      "Birinchi e'loningizni joylang — bir necha daqiqa vaqt oladi.";
  static const String statusActive = 'Faol';
  static const String statusSold = 'Sotildi';
  static const String statusExpired = 'Muddati tugagan';
  static const String statusDraft = 'Qoralama';
  static const String statusPending = 'Tekshiruvda';
  static const String statusBlocked = 'Bloklangan';
  static const String editTitle = "E'lonni tahrirlash";
  static const String editListing = 'Tahrirlash';
  static const String saveChanges = 'Saqlash';
  static const String changesSaved = "O'zgarishlar saqlandi";
  static const String editCategoryMissing =
      "Bu e'lon kategoriyasi topilmadi — tahrirlab bo'lmaydi";
  static const String markSold = 'Sotildi deb belgilash';
  static const String markSoldConfirm =
      "E'lon qidiruvdan olib tashlanadi. Buni orqaga qaytarib bo'lmaydi.";
  static const String markSoldDone = "E'lon sotilgan deb belgilandi";
  static const String deleteListing = "O'chirish";
  static const String deleteListingConfirm =
      "E'lon butunlay o'chiriladi. Buni orqaga qaytarib bo'lmaydi.";
  static const String deleteListingDone = "E'lon o'chirildi";
  static const String actionFailed = "Bajarilmadi — internetni tekshiring";
  static const String expiredHint =
      "Muddati tugagan. Qayta joylasangiz yana 14 kun ko'rinadi.";
  static const String renewListing = 'Qayta joylash';
  static const String renewDone = "E'lon yana 14 kun faol";
  static const String blockedHint =
      "Bu e'lon qoidalarga mos kelmagani uchun to'xtatilgan.";

  // Messages
  static const String inboxEmpty = 'Hali xabar yo\'q';
  static const String inboxEmptyHint =
      "E'lon sahifasidagi \"Yozish\" tugmasi orqali sotuvchiga yozing.";
  static const String messageHint = 'Xabar yozing…';
  static const String messageSendFailed = 'Yuborilmadi';
  static const String messageRetry = 'Qayta yuborish';
  static const String conversationEmpty = 'Suhbatni boshlang';
  static const String conversationEmptyHint =
      "Salomlashib, hajm va narx haqida so'rang.";
  static const String cannotChatWithSelf = "O'z e'loningizga yozib bo'lmaydi";
  static const String chatOpenFailed = "Suhbat ochilmadi — internetni tekshiring";
  static const String youPrefix = 'Siz: ';

  // Reviews
  static const String reviewsTitle = 'Baholar';
  static const String sellerTitleScreen = 'Sotuvchi';
  static const String noReviews = 'Hali baho yo\'q';
  static const String noReviewsHint =
      "Sotuvdan keyin xaridorlar baho qoldiradi.";
  static const String rateSeller = 'Sotuvchiga baho bering';
  static const String rateSellerHint =
      "Boshqa xaridorlar uchun — qanday o'tgani haqida yozing.";
  static const String reviewComment = 'Izoh (ixtiyoriy)';
  static const String sendReview = 'Yuborish';
  static const String reviewSent = 'Bahoingiz uchun rahmat';
  static const String reviewFailed = "Baho yuborilmadi — internetni tekshiring";
  static const String yourReview = 'Sizning bahongiz';
  static const String pickRating = 'Yulduzni tanlang';
  static const String sellerListings = "Sotuvchining e'lonlari";

  // Voice / AI composer
  static const String composerTitle = 'Gapirib aytish';
  static const String composerHint =
      "Bir gapda ayting — qolganini o'zi to'ldiradi";
  static const String composerPlaceholder =
      "12 tonna pomidor, kilosi 14 ming so'm";
  static const String startDictation = 'Gapirish';
  static const String stopDictation = "To'xtatish";
  static const String listening = 'Tinglanmoqda…';
  static const String fillForm = "Formani to'ldirish";
  static const String drafting = "To'ldirilmoqda…";
  static const String draftApplied = "Forma to'ldirildi — tekshirib chiqing";
  static const String stillNeeded = "Qolgan maydonlar";
  static const String aiNeverPublishes =
      "Yordamchi faqat to'ldiradi — joylashni o'zingiz tasdiqlaysiz";

  // Photos
  static const String photos = 'Rasmlar';
  static const String photosHint =
      "Rasmli e'lonlarga 3 barobar ko'p qo'ng'iroq qilinadi";
  static const String photosCoverHint =
      "Birinchi rasm asosiy — boshqasini bosib almashtiring";
  static const String addPhoto = "Rasm qo'shish";
  static const String takePhoto = 'Suratga olish';
  static const String fromGallery = 'Galereyadan tanlash';
  static const String coverPhoto = 'ASOSIY';
  static const String removePhoto = "Rasmni o'chirish";
  static const String removePhotoConfirm =
      "Bu rasm e'londan butunlay o'chiriladi.";
  static const String photosFull = "Ko'proq rasm qo'shib bo'lmaydi";
  static const String uploadingPhotos = 'Rasmlar yuklanmoqda…';

  // Posting a listing
  static const String chooseCategory = 'Nima sotmoqchisiz?';
  static const String listingTitle = 'Sarlavha';
  static const String listingTitleHint = 'Xaridor qidiruvda shuni ko\'radi';
  static const String listingTitlePlaceholder = 'Urgut pomidori, gruntda';
  static const String listingDescription = 'Tavsif';
  static const String listingDescriptionHint = 'Ixtiyoriy — navi, sifati, qadoq haqida';
  static const String whereFrom = 'Qayerdan';
  static const String extras = "Qo'shimcha";
  static const String wholesalePrice = 'Ulgurji narx';
  static const String notChosen = 'Tanlanmagan';
  static const String chooseDate = 'Sanani tanlash';
  static const String clear = 'Olib tashlash';
  static const String publish = "E'lonni joylash";
  static const String published = "E'lon joylandi";
  static const String publishedHint =
      "E'loningiz 14 kun faol turadi. Xaridorlar to'g'ridan-to'g'ri qo'ng'iroq qiladi.";
  static const String viewListing = "E'lonni ko'rish";
  static const String postAnother = 'Yana joylash';
  static const String fixErrors = "Ba'zi maydonlarni to'ldiring";
  static const String discardDraft = "E'londan voz kechasizmi?";
  static const String discard = 'Voz kechish';
  static const String keepEditing = 'Davom etish';

  /// Result counts read naturally in Uzbek without a plural form — the noun
  /// does not inflect after a number.
  static String resultCount(int count) => "$count ta e'lon";

  static String photosRemaining(int slots) => "Yana $slots ta rasm qo'shsa bo'ladi";

  /// Says what is already on the listing, because the strip cannot show it.
  /// An empty-looking picker on a listing with three photos reads as "the
  /// photos are gone".
  static String photosEditHint(int existing) => existing == 0
      ? "Yangi rasm qo'shishingiz mumkin"
      : "$existing ta rasm e'londa turibdi — o'chirsangiz ham, qo'shsangiz ham bo'ladi";

  static String photoOf(int index, int total) => '$index / $total';

  /// Says how old what is on screen is. Deliberately specific — "offline"
  /// alone leaves a farmer to guess whether these prices are an hour or a week
  /// out of date, and they will guess generously.
  static String offlineSince(String ago) => 'Oxirgi ma\'lumot: $ago';

  static String queuedCount(int count) => "$count ta e'lon navbatda";

  static String queuedPhotoCount(int count) => "$count ta rasm navbatda";

  static String reviewCount(int count) => '$count ta baho';

  /// Both at once. Two banners stacked on the home screen would push the
  /// listings themselves below the fold.
  static String queuedBoth(int listings, int photos) =>
      "$listings ta e'lon, $photos ta rasm navbatda";

  /// Warned about only near the end. A listing auto-expires after 14 days and
  /// a seller who was not told simply stops getting calls.
  static String expiresInDays(int days) =>
      days == 0 ? 'Bugun muddati tugaydi' : "$days kundan keyin muddati tugaydi";

  /// Names the listing being deleted. A queue can hold more than one, and
  /// "delete the queued listing?" does not say which.
  static String discardQueuedBody(String title) =>
      title.isEmpty ? discardQueuedFallback : '«$title» butunlay o\'chiriladi.';

  static const String discardQueuedFallback =
      "Bu e'lon butunlay o'chiriladi.";
}
