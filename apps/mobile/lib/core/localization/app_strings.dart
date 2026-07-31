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
  static const String sortVolumeDesc = 'Katta hajmlar';
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

  static String photoOf(int index, int total) => '$index / $total';
}
