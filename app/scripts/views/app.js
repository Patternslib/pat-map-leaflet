define(['backbone'], function (Backbone) {
    var App = Backbone.View.extend ({
        initialize : function(){
            console.log('backbone initialized');
        }
    });
    return App;
});
