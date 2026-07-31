import '../../domain/entities/category_form.dart';
import '../../domain/entities/units.dart';

/// A Dart mirror of the backend's `formSpecFor(kind)`.
///
/// The real specs come down with `GET /categories`; this stands in until the
/// API is wired. It is a mirror rather than a simplification on purpose — the
/// posting form's whole job is rendering whatever the server sends, and a mock
/// that returned one generic spec would let a form ship that has never been
/// asked to lock a unit select or draw a required attribute.
abstract final class FormSpecFixtures {
  /// The year ceiling moves with the calendar, so the spec is built per call
  /// rather than frozen — exactly as the backend does it.
  static CategoryFormSpec forKind(CategoryKind kind, {DateTime? now}) {
    final nextYear = (now ?? DateTime.now()).year + 1;

    return switch (kind) {
      CategoryKind.machinery => CategoryFormSpec(
          kind: kind,
          quantity: const MeasureSpec(
            labelUz: 'Nechta',
            hintUz: 'Sotuvdagi texnika soni',
            units: [QuantityUnit.dona],
            placeholder: '1',
          ),
          price: const MeasureSpec(
            labelUz: 'Narx',
            hintUz: "Bittasi uchun so'mda",
            units: [QuantityUnit.dona],
            placeholder: '85000000',
          ),
          optional: const OptionalFields(delivery: true),
          attributes: [
            const AttributeDef(
              key: 'condition',
              labelUz: 'Holati',
              type: AttributeType.select,
              required: true,
              options: _condition,
            ),
            AttributeDef(
              key: 'year',
              labelUz: 'Ishlab chiqarilgan yil',
              type: AttributeType.number,
              required: false,
              min: 1950,
              max: nextYear,
              placeholderUz: '2018',
            ),
            const AttributeDef(
              key: 'brand',
              labelUz: 'Rusumi',
              type: AttributeType.text,
              required: false,
              maxLength: 60,
              placeholderUz: 'MTZ-82',
            ),
            const AttributeDef(
              key: 'hours',
              labelUz: 'Ish soati',
              type: AttributeType.number,
              required: false,
              min: 0,
              max: 200000,
              suffixUz: 'soat',
            ),
          ],
        ),
      CategoryKind.service => const CategoryFormSpec(
          kind: CategoryKind.service,
          quantity: MeasureSpec(
            labelUz: 'Hajm',
            hintUz: 'Bir mavsumda bajara oladigan hajmingiz',
            units: [QuantityUnit.xizmat, QuantityUnit.ga, QuantityUnit.t],
            placeholder: '50',
          ),
          price: MeasureSpec(
            labelUz: 'Narx',
            hintUz: "Bir birlik ish uchun so'mda",
            units: [
              QuantityUnit.xizmat,
              QuantityUnit.ga,
              QuantityUnit.t,
              QuantityUnit.kg,
            ],
            placeholder: '400000',
          ),
          optional: OptionalFields(minOrder: true, seasonMonths: true),
          attributes: [
            AttributeDef(
              key: 'coverage',
              labelUz: 'Qamrov',
              type: AttributeType.select,
              required: true,
              options: [
                AttributeOption(value: 'district', labelUz: 'Tuman ichida'),
                AttributeOption(value: 'region', labelUz: 'Viloyat bo‘ylab'),
                AttributeOption(value: 'country', labelUz: 'Respublika bo‘ylab'),
              ],
            ),
            AttributeDef(
              key: 'experienceYears',
              labelUz: 'Tajriba',
              type: AttributeType.number,
              required: false,
              min: 0,
              max: 70,
              suffixUz: 'yil',
            ),
          ],
        ),
      CategoryKind.land => const CategoryFormSpec(
          kind: CategoryKind.land,
          quantity: MeasureSpec(
            labelUz: 'Maydon',
            hintUz: 'Yer maydoni gektarda',
            units: [QuantityUnit.ga],
            placeholder: '4.5',
          ),
          price: MeasureSpec(
            labelUz: 'Narx',
            hintUz: "1 gektar uchun so'mda",
            units: [QuantityUnit.ga],
            placeholder: '120000000',
          ),
          optional: OptionalFields(),
          attributes: [
            AttributeDef(
              key: 'tenure',
              labelUz: 'Turi',
              type: AttributeType.select,
              required: true,
              options: [
                AttributeOption(value: 'sale', labelUz: 'Sotuv'),
                AttributeOption(value: 'lease', labelUz: 'Ijara'),
              ],
            ),
            AttributeDef(
              key: 'irrigation',
              labelUz: 'Sug‘orish',
              type: AttributeType.select,
              required: true,
              options: [
                AttributeOption(value: 'yes', labelUz: 'Suv bor'),
                AttributeOption(value: 'no', labelUz: 'Suv yo‘q'),
              ],
            ),
            AttributeDef(
              key: 'purpose',
              labelUz: 'Maqsadi',
              type: AttributeType.select,
              required: false,
              options: [
                AttributeOption(value: 'field', labelUz: 'Dehqonchilik'),
                AttributeOption(value: 'orchard', labelUz: 'Bog‘'),
                AttributeOption(value: 'greenhouse', labelUz: 'Issiqxona'),
                AttributeOption(value: 'pasture', labelUz: 'Yaylov'),
              ],
            ),
          ],
        ),
      CategoryKind.supply => const CategoryFormSpec(
          kind: CategoryKind.supply,
          quantity: MeasureSpec(
            labelUz: 'Miqdor',
            hintUz: 'Omborda turgan miqdor',
            units: _supplyUnits,
            placeholder: '200',
          ),
          price: MeasureSpec(
            labelUz: 'Narx',
            hintUz: "Bir birlik uchun so'mda",
            units: _supplyUnits,
            placeholder: '35000',
          ),
          optional: OptionalFields(
            minOrder: true,
            wholesalePrice: true,
            delivery: true,
          ),
          attributes: [
            AttributeDef(
              key: 'brand',
              labelUz: 'Ishlab chiqaruvchi',
              type: AttributeType.text,
              required: false,
              maxLength: 60,
              placeholderUz: 'Agrokimyo',
            ),
            AttributeDef(
              key: 'packWeight',
              labelUz: 'Qadoq og‘irligi',
              type: AttributeType.text,
              required: false,
              maxLength: 30,
              placeholderUz: '50 kg',
            ),
          ],
        ),
      // Produce is the permissive default: it asks the most and requires none.
      CategoryKind.produce => const CategoryFormSpec(
          kind: CategoryKind.produce,
          quantity: MeasureSpec(
            labelUz: 'Hajm',
            hintUz: 'Sotuvga tayyor umumiy hajm',
            units: _produceUnits,
            placeholder: '12',
          ),
          price: MeasureSpec(
            labelUz: 'Narx',
            hintUz: "1 birlik uchun so'mda",
            units: _produceUnits,
            placeholder: '14000',
          ),
          optional: OptionalFields(
            minOrder: true,
            wholesalePrice: true,
            harvestDate: true,
            seasonMonths: true,
            delivery: true,
          ),
          attributes: [
            AttributeDef(
              key: 'grade',
              labelUz: 'Navi',
              type: AttributeType.select,
              required: false,
              options: [
                AttributeOption(value: 'first', labelUz: '1-nav'),
                AttributeOption(value: 'second', labelUz: '2-nav'),
                AttributeOption(value: 'third', labelUz: '3-nav'),
              ],
            ),
            AttributeDef(
              key: 'packaging',
              labelUz: 'Qadoq',
              type: AttributeType.select,
              required: false,
              options: [
                AttributeOption(value: 'box', labelUz: 'Quti'),
                AttributeOption(value: 'bag', labelUz: 'Qop'),
                AttributeOption(value: 'crate', labelUz: 'Yashik'),
                AttributeOption(value: 'pallet', labelUz: 'Palet'),
                AttributeOption(value: 'bulk', labelUz: 'Qadoqsiz'),
              ],
            ),
            AttributeDef(
              key: 'organic',
              labelUz: 'Yetishtirish',
              type: AttributeType.select,
              required: false,
              options: [
                AttributeOption(value: 'organic', labelUz: 'Kimyosiz'),
                AttributeOption(value: 'standard', labelUz: 'Odatiy'),
              ],
            ),
          ],
        ),
    };
  }

  static const List<AttributeOption> _condition = [
    AttributeOption(value: 'new', labelUz: 'Yangi'),
    AttributeOption(value: 'used', labelUz: 'Ishlatilgan'),
  ];

  static const List<QuantityUnit> _produceUnits = [
    QuantityUnit.kg,
    QuantityUnit.t,
    QuantityUnit.quti,
    QuantityUnit.qop,
    QuantityUnit.litr,
    QuantityUnit.dona,
  ];

  static const List<QuantityUnit> _supplyUnits = [
    QuantityUnit.kg,
    QuantityUnit.qop,
    QuantityUnit.dona,
    QuantityUnit.litr,
    QuantityUnit.t,
    QuantityUnit.quti,
  ];
}
