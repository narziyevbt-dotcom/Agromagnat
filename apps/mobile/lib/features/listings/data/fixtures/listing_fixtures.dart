import '../../domain/entities/listing.dart';
import '../../domain/entities/seller.dart';
import '../../domain/entities/units.dart';
import 'catalog_fixtures.dart';

/// Seed listings for the mock repository.
///
/// Prices are roughly what these crops actually fetched wholesale, and the
/// volumes span three orders of magnitude — 40 kg of herbs up to 120 t of
/// wheat. That spread is the point: it is what proves the green volume chip
/// and the price line still align when one card says "40 kg" and the next
/// says "120 t".
///
/// Times are expressed relative to a passed-in `now` so "2 soat oldin" stays
/// true whenever the app is opened, and so tests can pin it.
abstract final class ListingFixtures {
  static const List<Seller> sellers = [
    Seller(
      id: 'sel-1',
      phone: '998901234567',
      name: 'Sardor Aliyev',
      isVerified: true,
      ratingAvg: 4.8,
      ratingCount: 24,
      salesCount: 31,
    ),
    Seller(
      id: 'sel-2',
      phone: '998935558811',
      name: 'Nodira Karimova',
      isVerified: true,
      ratingAvg: 4.6,
      ratingCount: 12,
      salesCount: 15,
    ),
    Seller(
      id: 'sel-3',
      phone: '998977001122',
      name: 'Baxtiyor Toshmatov',
      ratingAvg: 4.2,
      ratingCount: 5,
      salesCount: 7,
    ),
    Seller(
      id: 'sel-4',
      phone: '998909998877',
      name: "Zafar Ro'ziyev",
      isVerified: true,
      ratingAvg: 5,
      ratingCount: 41,
      salesCount: 58,
    ),
    Seller(
      id: 'sel-5',
      phone: '998946663344',
      name: 'Dilshod Ergashev',
      ratingAvg: 3.9,
      ratingCount: 2,
      salesCount: 3,
    ),
  ];

  static Seller _seller(String id) =>
      sellers.firstWhere((seller) => seller.id == id);

  /// Builds the seed set. [now] anchors every relative timestamp.
  static List<Listing> build(DateTime now) {
    final seeds = <_Seed>[
      _Seed(
        id: 'lst-01',
        title: 'Urgut pomidori, gruntda yetishtirilgan',
        description:
            "Urgut tumanida ochiq gruntda yetishtirilgan pomidor. Bir tekis, "
            "qizil, transportga chidamli nav. Yig'im har kuni ertalab. "
            "Qadoqlash 10 kg lik yashiklarda, yashik narxga kiritilgan.",
        categoryId: 'cat-sabzavot',
        regionId: 'reg-sam',
        districtId: 'dis-urgut',
        sellerId: 'sel-1',
        quantity: 12,
        quantityUnit: QuantityUnit.t,
        price: 9500,
        minOrder: 1,
        delivery: DeliveryOption.both,
        isPromoted: true,
        hoursAgo: 2,
        harvestDaysAgo: 1,
        viewCount: 412,
        callCount: 37,
        favoriteCount: 18,
      ),
      _Seed(
        id: 'lst-02',
        title: "Chust uzumi — husayni, ulgurji",
        description:
            "Husayni navli uzum, qo'lda terilgan va saralangan. Sovutgichda "
            "saqlanadi, uzoq masofaga yuborishga tayyor.",
        categoryId: 'cat-meva',
        regionId: 'reg-nam',
        districtId: 'dis-chust',
        sellerId: 'sel-4',
        quantity: 8.5,
        quantityUnit: QuantityUnit.t,
        price: 21000,
        minOrder: 0.5,
        delivery: DeliveryOption.delivery,
        isPromoted: true,
        hoursAgo: 5,
        harvestDaysAgo: 2,
        viewCount: 289,
        callCount: 22,
        favoriteCount: 31,
      ),
      _Seed(
        id: 'lst-03',
        title: "Bug'doy, 3-sinf, omborda",
        description:
            "O'tgan mavsum hosili, namligi 13% dan past. Omborda saqlanmoqda, "
            "istalgan hajmda yuklab berish mumkin. Laboratoriya tahlili bor.",
        categoryId: 'cat-don',
        regionId: 'reg-jiz',
        districtId: 'dis-zomin',
        sellerId: 'sel-2',
        quantity: 120,
        quantityUnit: QuantityUnit.t,
        price: 4200,
        minOrder: 10,
        delivery: DeliveryOption.pickup,
        hoursAgo: 9,
        viewCount: 156,
        callCount: 14,
        favoriteCount: 9,
      ),
      _Seed(
        id: 'lst-04',
        title: 'Xorazm tarvuzi, qorabosh nav',
        description:
            "Qumli yerda yetishtirilgan tarvuz, o'rtacha vazni 8-10 kg. "
            "Dala boshidan yuklanadi.",
        categoryId: 'cat-poliz',
        regionId: 'reg-xor',
        districtId: 'dis-xiva',
        sellerId: 'sel-3',
        quantity: 30,
        quantityUnit: QuantityUnit.t,
        price: 3800,
        minOrder: 3,
        delivery: DeliveryOption.pickup,
        hoursAgo: 20,
        harvestDaysAgo: 1,
        viewCount: 203,
        callCount: 19,
        favoriteCount: 12,
      ),
      _Seed(
        id: 'lst-05',
        title: "Bodom mag'zi, qog'ozqobiq",
        description:
            "Qo'lda tozalangan bodom mag'zi, butun va sifatli. 25 kg lik "
            "qoplarda. Namuna yuborish mumkin.",
        categoryId: 'cat-quruq',
        regionId: 'reg-sur',
        districtId: 'dis-denov',
        sellerId: 'sel-4',
        quantity: 900,
        quantityUnit: QuantityUnit.kg,
        price: 78000,
        minOrder: 25,
        delivery: DeliveryOption.both,
        hoursAgo: 26,
        viewCount: 341,
        callCount: 28,
        favoriteCount: 44,
      ),
      _Seed(
        id: 'lst-06',
        title: 'Kartoshka, Pikasso navi',
        description:
            "Oziq-ovqat uchun kartoshka, kalibri 55+. Omborda saqlanadi, "
            "qishgacha yetadi.",
        categoryId: 'cat-sabzavot',
        regionId: 'reg-sam',
        districtId: 'dis-pastdargom',
        sellerId: 'sel-1',
        quantity: 45,
        quantityUnit: QuantityUnit.t,
        price: 5600,
        minOrder: 2,
        delivery: DeliveryOption.both,
        hoursAgo: 32,
        viewCount: 178,
        callCount: 16,
        favoriteCount: 7,
      ),
      _Seed(
        id: 'lst-07',
        title: "Ko'k piyoz va jambil, har kuni",
        description:
            "Issiqxonada yetishtiriladi, har kuni ertalab terib beriladi. "
            "Restoran va do'konlar uchun doimiy yetkazib berish.",
        categoryId: 'cat-kokat',
        regionId: 'reg-tos',
        districtId: 'dis-parkent',
        sellerId: 'sel-5',
        quantity: 40,
        quantityUnit: QuantityUnit.kg,
        price: 12000,
        delivery: DeliveryOption.delivery,
        hoursAgo: 40,
        harvestDaysAgo: 0,
        viewCount: 92,
        callCount: 11,
        favoriteCount: 4,
      ),
      _Seed(
        id: 'lst-08',
        title: 'Olma — golden, sovutgichdan',
        description:
            "Golden navli olma, kalibri 70+. Sovutgichda saqlangan, qattiq va "
            "shirali. Yashiklarda beriladi.",
        categoryId: 'cat-meva',
        regionId: 'reg-fer',
        districtId: 'dis-rishton',
        sellerId: 'sel-2',
        quantity: 18,
        quantityUnit: QuantityUnit.t,
        price: 13500,
        minOrder: 1,
        delivery: DeliveryOption.both,
        hoursAgo: 52,
        viewCount: 244,
        callCount: 21,
        favoriteCount: 15,
      ),
      _Seed(
        id: 'lst-09',
        title: "Sabzi, qishki nav, yuvilgan",
        description: "Yuvilgan va saralangan sabzi, 20 kg lik to'rlarda.",
        categoryId: 'cat-sabzavot',
        regionId: 'reg-and',
        districtId: 'dis-asaka',
        sellerId: 'sel-3',
        quantity: 22,
        quantityUnit: QuantityUnit.t,
        price: 6400,
        minOrder: 1,
        delivery: DeliveryOption.pickup,
        hoursAgo: 70,
        viewCount: 131,
        callCount: 9,
        favoriteCount: 6,
      ),
      _Seed(
        id: 'lst-10',
        title: "Qo'y — qorako'l zoti, boqilgan",
        description:
            "Sog'lom, veterinar hujjatlari bilan. O'rtacha tirik vazni 55 kg. "
            "Katta partiya uchun narx kelishiladi.",
        categoryId: 'cat-chorva',
        regionId: 'reg-nav',
        districtId: 'dis-karmana',
        sellerId: 'sel-4',
        quantity: 140,
        quantityUnit: QuantityUnit.dona,
        price: 2400000,
        minOrder: 5,
        delivery: DeliveryOption.pickup,
        hoursAgo: 96,
        viewCount: 412,
        callCount: 44,
        favoriteCount: 27,
      ),
      _Seed(
        id: 'lst-11',
        title: "Pomidor ko'chati, F1 gibrid",
        description:
            "Kassetada yetishtirilgan ko'chat, ildizi kuchli. Fevral-mart "
            "ekish uchun. Buyurtma oldindan qabul qilinadi.",
        categoryId: 'cat-urug',
        regionId: 'reg-tos',
        districtId: 'dis-boka',
        sellerId: 'sel-5',
        quantity: 25000,
        quantityUnit: QuantityUnit.dona,
        price: 900,
        minOrder: 1000,
        delivery: DeliveryOption.both,
        hoursAgo: 120,
        viewCount: 88,
        callCount: 7,
        favoriteCount: 5,
      ),
      _Seed(
        id: 'lst-12',
        title: "Anor — Qizil anor, Shahrisabz",
        description:
            "Yirik, shirin anor. Eksport talabiga javob beradi, saralangan "
            "holda qutilarda.",
        categoryId: 'cat-meva',
        regionId: 'reg-qas',
        districtId: 'dis-shahrisabz',
        sellerId: 'sel-1',
        quantity: 14,
        quantityUnit: QuantityUnit.t,
        price: 17000,
        minOrder: 1,
        delivery: DeliveryOption.delivery,
        hoursAgo: 150,
        viewCount: 267,
        callCount: 25,
        favoriteCount: 22,
      ),
      _Seed(
        id: 'lst-13',
        title: "Traktor MTZ-82, 2019-yil",
        description:
            "Ishchi holatda, hujjatlari joyida. Yillik texnik ko'rikdan "
            "o'tgan. Ko'rish uchun kelishiladi.",
        categoryId: 'cat-texnika',
        regionId: 'reg-sir',
        districtId: 'dis-guliston',
        sellerId: 'sel-3',
        quantity: 1,
        quantityUnit: QuantityUnit.dona,
        price: 185000000,
        delivery: DeliveryOption.pickup,
        hoursAgo: 200,
        viewCount: 523,
        callCount: 38,
        favoriteCount: 19,
      ),
      _Seed(
        id: 'lst-14',
        title: "Mash, tozalangan, eksport sifati",
        description: "Tozalangan va kalibrlangan mash, 50 kg lik qoplarda.",
        categoryId: 'cat-don',
        regionId: 'reg-bux',
        districtId: 'dis-gijduvon',
        sellerId: 'sel-2',
        quantity: 6,
        quantityUnit: QuantityUnit.t,
        price: 19500,
        minOrder: 0.5,
        delivery: DeliveryOption.both,
        hoursAgo: 260,
        viewCount: 149,
        callCount: 12,
        favoriteCount: 8,
      ),
      _Seed(
        id: 'lst-15',
        title: "Qovun — Gulobi, Nukus",
        description: "Gulobi navli qovun, xushbo'y va shirin. Dala narxi.",
        categoryId: 'cat-poliz',
        regionId: 'reg-qor',
        districtId: 'dis-nukus',
        sellerId: 'sel-5',
        quantity: 16,
        quantityUnit: QuantityUnit.t,
        price: 7200,
        minOrder: 2,
        delivery: DeliveryOption.pickup,
        hoursAgo: 300,
        harvestDaysAgo: 4,
        viewCount: 97,
        callCount: 8,
        favoriteCount: 3,
      ),
    ];

    return [
      for (final seed in seeds) seed.toListing(now),
    ];
  }
}

/// A listing before its timestamps are resolved against `now`.
class _Seed {
  const _Seed({
    required this.id,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.regionId,
    required this.districtId,
    required this.sellerId,
    required this.quantity,
    required this.quantityUnit,
    required this.price,
    required this.hoursAgo,
    this.minOrder,
    this.delivery = DeliveryOption.none,
    this.isPromoted = false,
    this.harvestDaysAgo,
    this.viewCount = 0,
    this.callCount = 0,
    this.favoriteCount = 0,
  });

  final String id;
  final String title;
  final String description;
  final String categoryId;
  final String regionId;
  final String districtId;
  final String sellerId;
  final num quantity;
  final QuantityUnit quantityUnit;
  final num price;
  final num? minOrder;
  final DeliveryOption delivery;
  final bool isPromoted;
  final int hoursAgo;
  final int? harvestDaysAgo;
  final int viewCount;
  final int callCount;
  final int favoriteCount;

  Listing toListing(DateTime now) {
    final createdAt = now.subtract(Duration(hours: hoursAgo));

    return Listing(
      id: id,
      title: title,
      description: description,
      status: ListingStatus.active,
      quantity: quantity,
      quantityUnit: quantityUnit,
      price: price,
      // Price is always quoted per the same unit the volume is measured in —
      // "12 t at 9 500 so'm/t", never a mix.
      priceUnit: quantityUnit,
      minOrder: minOrder,
      category: CatalogFixtures.categoryById(categoryId),
      region: CatalogFixtures.regionById(regionId),
      district: CatalogFixtures.districtById(districtId),
      seller: ListingFixtures._seller(sellerId),
      harvestDate: harvestDaysAgo == null
          ? null
          : now.subtract(Duration(days: harvestDaysAgo!)),
      delivery: delivery,
      isPromoted: isPromoted,
      viewCount: viewCount,
      callCount: callCount,
      favoriteCount: favoriteCount,
      createdAt: createdAt,
      // Listings auto-expire 14 days after posting.
      expiresAt: createdAt.add(const Duration(days: 14)),
    );
  }
}
