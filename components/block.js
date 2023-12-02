polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  isKbEntity: Ember.computed('block.entity.types.[]', function () {
    return this.get('block.entity.types').includes('custom.kb');
  }),
  isCveEntity: Ember.computed('block.entity.types.[]', function () {
    return this.get('block.entity.types').includes('cve');
  })
});
