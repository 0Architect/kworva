// Keyword → category name. Used by the composer to auto-suggest a category.
// Returns a name that matches the seeded categories table exactly.
export function guessCategoryName(text: string): string {
  const s = text.toLowerCase();
  if (/(food|rice|jollof|indomie|shawarma|cook|snack|egg|drink|chop|chicken|pepper|beans|eba|stew|fried|puff|amala|suya|burger)/.test(s)) return 'Food';
  if (/(fix|repair|crack|broken|screen|spoil|fault|leak|sew|stitch|sole|weld)/.test(s)) return 'Repairs';
  if (/(thrift|okrika|hoodie|cloth|shoe|jean|ankara|dress|shirt|trouser|wear|top|bag|cap|belt)/.test(s)) return 'Thrift';
  if (/(past.?question|assignment|note|tutor|course|lecture|exam|study|quiz|test|eco|mth|gst|csc|phy|che|bio|law|med)/.test(s)) return 'Academics';
  if (/(barber|hair|nail|makeup|cut|shave|lash|braid|brow|lotion|spa|wax)/.test(s)) return 'Grooming';
  if (/(charger|power.?bank|laptop|phone|cable|earpiece|adapter|gadget|usb|type.?c|iphone|samsung|airpod|speaker)/.test(s)) return 'Electronics';
  if (/(dinner|party|aso|agbada|event|native|gown|ticket|concert|outing|ceremony|reception)/.test(s)) return 'Events';
  if (/(errand|delivery|pick.?up|drop.?off|send|bring|carry|run|collect|submit)/.test(s)) return 'Errands';
  return 'Other';
}
