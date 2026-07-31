import '../../domain/entities/category.dart';
import '../../domain/entities/location.dart';
import '../../domain/entities/units.dart';

/// Reference data for the mock repositories.
///
/// Real names throughout — Urgut, Chinoz, Bo'ka — because a screen filled with
/// "Region 1 / District 2" hides exactly the layout problems that matter: the
/// longest region name has to fit a chip, and "Qashqadaryo · Shahrisabz" has
/// to fit a card without truncating.
abstract final class CatalogFixtures {
  static const List<Region> regions = [
    Region(id: 'reg-tos', nameUz: 'Toshkent', slug: 'toshkent'),
    Region(id: 'reg-sam', nameUz: 'Samarqand', slug: 'samarqand'),
    Region(id: 'reg-fer', nameUz: "Farg'ona", slug: 'fargona'),
    Region(id: 'reg-and', nameUz: 'Andijon', slug: 'andijon'),
    Region(id: 'reg-nam', nameUz: 'Namangan', slug: 'namangan'),
    Region(id: 'reg-bux', nameUz: 'Buxoro', slug: 'buxoro'),
    Region(id: 'reg-xor', nameUz: 'Xorazm', slug: 'xorazm'),
    Region(id: 'reg-qas', nameUz: 'Qashqadaryo', slug: 'qashqadaryo'),
    Region(id: 'reg-sur', nameUz: 'Surxondaryo', slug: 'surxondaryo'),
    Region(id: 'reg-jiz', nameUz: 'Jizzax', slug: 'jizzax'),
    Region(id: 'reg-sir', nameUz: 'Sirdaryo', slug: 'sirdaryo'),
    Region(id: 'reg-nav', nameUz: 'Navoiy', slug: 'navoiy'),
    Region(id: 'reg-qor', nameUz: "Qoraqalpog'iston", slug: 'qoraqalpogiston'),
  ];

  static const List<District> districts = [
    District(id: 'dis-chinoz', regionId: 'reg-tos', nameUz: 'Chinoz', slug: 'chinoz'),
    District(id: 'dis-boka', regionId: 'reg-tos', nameUz: "Bo'ka", slug: 'boka'),
    District(id: 'dis-parkent', regionId: 'reg-tos', nameUz: 'Parkent', slug: 'parkent'),
    District(id: 'dis-urgut', regionId: 'reg-sam', nameUz: 'Urgut', slug: 'urgut'),
    District(id: 'dis-jomboy', regionId: 'reg-sam', nameUz: 'Jomboy', slug: 'jomboy'),
    District(id: 'dis-pastdargom', regionId: 'reg-sam', nameUz: "Pastdarg'om", slug: 'pastdargom'),
    District(id: 'dis-quva', regionId: 'reg-fer', nameUz: 'Quva', slug: 'quva'),
    District(id: 'dis-rishton', regionId: 'reg-fer', nameUz: 'Rishton', slug: 'rishton'),
    District(id: 'dis-asaka', regionId: 'reg-and', nameUz: 'Asaka', slug: 'asaka'),
    District(id: 'dis-shahrixon', regionId: 'reg-and', nameUz: 'Shahrixon', slug: 'shahrixon'),
    District(id: 'dis-chust', regionId: 'reg-nam', nameUz: 'Chust', slug: 'chust'),
    District(id: 'dis-pop', regionId: 'reg-nam', nameUz: 'Pop', slug: 'pop'),
    District(id: 'dis-gijduvon', regionId: 'reg-bux', nameUz: 'G‘ijduvon', slug: 'gijduvon'),
    District(id: 'dis-xiva', regionId: 'reg-xor', nameUz: 'Xiva', slug: 'xiva'),
    District(id: 'dis-shahrisabz', regionId: 'reg-qas', nameUz: 'Shahrisabz', slug: 'shahrisabz'),
    District(id: 'dis-denov', regionId: 'reg-sur', nameUz: 'Denov', slug: 'denov'),
    District(id: 'dis-zomin', regionId: 'reg-jiz', nameUz: 'Zomin', slug: 'zomin'),
    District(id: 'dis-guliston', regionId: 'reg-sir', nameUz: 'Guliston', slug: 'guliston'),
    District(id: 'dis-karmana', regionId: 'reg-nav', nameUz: 'Karmana', slug: 'karmana'),
    District(id: 'dis-nukus', regionId: 'reg-qor', nameUz: 'Nukus', slug: 'nukus'),
  ];

  static const List<ListingCategory> categories = [
    ListingCategory(
      id: 'cat-meva',
      nameUz: 'Mevalar',
      slug: 'mevalar',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.t,
      emoji: '🍎',
      isFeatured: true,
      sortOrder: 1,
    ),
    ListingCategory(
      id: 'cat-sabzavot',
      nameUz: 'Sabzavotlar',
      slug: 'sabzavotlar',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.t,
      emoji: '🥕',
      isFeatured: true,
      sortOrder: 2,
    ),
    ListingCategory(
      id: 'cat-poliz',
      nameUz: 'Poliz ekinlari',
      slug: 'poliz',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.t,
      emoji: '🍉',
      isFeatured: true,
      sortOrder: 3,
    ),
    ListingCategory(
      id: 'cat-don',
      nameUz: 'Don va dukkakli',
      slug: 'don',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.t,
      emoji: '🌾',
      isFeatured: true,
      sortOrder: 4,
    ),
    ListingCategory(
      id: 'cat-quruq',
      nameUz: 'Quruq mevalar',
      slug: 'quruq-mevalar',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.kg,
      emoji: '🥜',
      isFeatured: true,
      sortOrder: 5,
    ),
    ListingCategory(
      id: 'cat-kokat',
      nameUz: "Ko'katlar",
      slug: 'kokatlar',
      kind: CategoryKind.produce,
      unitDefault: QuantityUnit.kg,
      emoji: '🌿',
      isFeatured: true,
      sortOrder: 6,
    ),
    ListingCategory(
      id: 'cat-chorva',
      nameUz: 'Chorva mollari',
      slug: 'chorva',
      kind: CategoryKind.supply,
      unitDefault: QuantityUnit.dona,
      emoji: '🐄',
      isFeatured: true,
      sortOrder: 7,
    ),
    ListingCategory(
      id: 'cat-urug',
      nameUz: "Urug' va ko'chat",
      slug: 'urug-kochat',
      kind: CategoryKind.supply,
      unitDefault: QuantityUnit.kg,
      emoji: '🌱',
      isFeatured: true,
      sortOrder: 8,
    ),
    ListingCategory(
      id: 'cat-texnika',
      nameUz: 'Qishloq texnikasi',
      slug: 'texnika',
      kind: CategoryKind.machinery,
      unitDefault: QuantityUnit.dona,
      emoji: '🚜',
      sortOrder: 9,
    ),
    ListingCategory(
      id: 'cat-xizmat',
      nameUz: 'Xizmatlar',
      slug: 'xizmatlar',
      kind: CategoryKind.service,
      unitDefault: QuantityUnit.xizmat,
      emoji: '🛠',
      sortOrder: 10,
    ),
  ];

  static Region regionById(String id) =>
      regions.firstWhere((region) => region.id == id);

  static District districtById(String id) =>
      districts.firstWhere((district) => district.id == id);

  static ListingCategory categoryById(String id) =>
      categories.firstWhere((category) => category.id == id);
}
