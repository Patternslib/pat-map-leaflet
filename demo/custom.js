define([
    "registry",
], function(registry) {
   var _ = {
        name: "custom",
        trigger: ".pat-custom",

        init: function($el, opts) {
        	console.log('custom initialised');
        }
    };

    registry.register(_);
    return _;
});
