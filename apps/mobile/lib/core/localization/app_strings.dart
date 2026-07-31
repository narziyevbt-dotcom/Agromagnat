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

  /// Result counts read naturally in Uzbek without a plural form — the noun
  /// does not inflect after a number.
  static String resultCount(int count) => "$count ta e'lon";
}
