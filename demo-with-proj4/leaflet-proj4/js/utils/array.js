define(function () {

    var nativeForEach = function (list, callback, thisArg) {
        [].forEach.call(list, callback, thisArg);
    },
    customForEach = function (list, callback, thisArg) {
        var T, k = 0, O, len, kValue;

        if ( list == null ) {
            throw new TypeError( " this is null or not defined" );
        }

        O = Object(list);
        len = O.length >>> 0;

        if ( {}.toString.call(callback) != "[object Function]" ) {
            throw new TypeError( callback + " is not a function" );
        }

        if ( thisArg ) {
            T = thisArg;
        }

        while( k < len ) {
            if ( k in O ) {
                kValue = O[k];
                callback.call(T, kValue, k, O);
            }
            k++;
        }
    };

    return {
        forEach: (function () {
            if ({}.toString.call([].forEach) === "[object Function]") {
                return nativeForEach;
            } else {
                return customForEach;
            }
        }())
    };
});
