polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  isKbEntity: false,
  isCveEntity: false,
  init() {
    if (this.get('block.entity.type') === 'custom') {
      if (this.get('block.entity.types').includes('custom.kb')) this.set('isKbEntity', true);
      if (this.get('block.entity.types').includes('custom.cve')) this.set('isCveEntity', true);
    }
    this._super(...arguments);
  }
});
