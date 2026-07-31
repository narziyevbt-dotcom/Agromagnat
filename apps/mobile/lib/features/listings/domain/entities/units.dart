/// Units, statuses and delivery options.
///
/// These mirror `apps/web/lib/types.ts` because both clients read the same
/// API. The wire values are lowercase strings; [fromWire] is deliberately
/// total — an unknown value coming back from a newer backend degrades to a
/// sensible default instead of throwing in the middle of a feed.
library;

enum QuantityUnit {
  kg('kg', 'kg'),
  t('t', 't'),
  dona('dona', 'dona'),
  quti('quti', 'quti'),
  qop('qop', 'qop'),
  litr('l', 'l'),
  ga('ga', 'ga'),
  xizmat('xizmat', 'xizmat');

  const QuantityUnit(this.wire, this.label);

  /// The value the API sends and expects.
  final String wire;

  /// What the user reads, Uzbek. Same string for now — kept separate so a
  /// label can be spelled out later without touching the protocol.
  final String label;

  static QuantityUnit fromWire(String? value) {
    return QuantityUnit.values.firstWhere(
      (unit) => unit.wire == value,
      orElse: () => QuantityUnit.kg,
    );
  }
}

/// Price is quoted per the same set of units as quantity ("so'm/kg").
typedef PriceUnit = QuantityUnit;

enum ListingStatus {
  draft('draft'),
  pending('pending'),
  active('active'),
  sold('sold'),
  expired('expired'),
  blocked('blocked');

  const ListingStatus(this.wire);

  final String wire;

  /// Only an active listing is reachable from the feed or search.
  bool get isPublic => this == ListingStatus.active;

  static ListingStatus fromWire(String? value) {
    return ListingStatus.values.firstWhere(
      (status) => status.wire == value,
      orElse: () => ListingStatus.active,
    );
  }
}

enum DeliveryOption {
  none('none', 'Kelib olish kerak'),
  pickup('pickup', 'Olib ketish'),
  delivery('delivery', 'Yetkazib berish'),
  both('both', 'Olib ketish yoki yetkazish');

  const DeliveryOption(this.wire, this.label);

  final String wire;
  final String label;

  static DeliveryOption fromWire(String? value) {
    return DeliveryOption.values.firstWhere(
      (option) => option.wire == value,
      orElse: () => DeliveryOption.none,
    );
  }
}

/// Which questions a category's posting form asks. Produce wants a volume and
/// a picking date; machinery wants a count and a year.
enum CategoryKind {
  produce('produce'),
  supply('supply'),
  machinery('machinery'),
  service('service'),
  land('land');

  const CategoryKind(this.wire);

  final String wire;

  static CategoryKind fromWire(String? value) {
    return CategoryKind.values.firstWhere(
      (kind) => kind.wire == value,
      orElse: () => CategoryKind.produce,
    );
  }
}
