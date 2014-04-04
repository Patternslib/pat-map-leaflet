/**
 * Patterns bundle 1.5.0-833fd8a9
 *
 * See http://patternslib.com/ for more information.
 *
 * Included patterns:
 * - pat/inject
 */


/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("bundle", function(){});

/*!
 * jQuery JavaScript Library v1.8.3
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright 2012 jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: Tue Nov 13 2012 08:20:33 GMT-0500 (Eastern Standard Time)
 */
(function( window, undefined ) {
var
    // A central reference to the root jQuery(document)
    rootjQuery,

    // The deferred used on DOM ready
    readyList,

    // Use the correct document accordingly with window argument (sandbox)
    document = window.document,
    location = window.location,
    navigator = window.navigator,

    // Map over jQuery in case of overwrite
    _jQuery = window.jQuery,

    // Map over the $ in case of overwrite
    _$ = window.$,

    // Save a reference to some core methods
    core_push = Array.prototype.push,
    core_slice = Array.prototype.slice,
    core_indexOf = Array.prototype.indexOf,
    core_toString = Object.prototype.toString,
    core_hasOwn = Object.prototype.hasOwnProperty,
    core_trim = String.prototype.trim,

    // Define a local copy of jQuery
    jQuery = function( selector, context ) {
        // The jQuery object is actually just the init constructor 'enhanced'
        return new jQuery.fn.init( selector, context, rootjQuery );
    },

    // Used for matching numbers
    core_pnum = /[\-+]?(?:\d*\.|)\d+(?:[eE][\-+]?\d+|)/.source,

    // Used for detecting and trimming whitespace
    core_rnotwhite = /\S/,
    core_rspace = /\s+/,

    // Make sure we trim BOM and NBSP (here's looking at you, Safari 5.0 and IE)
    rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

    // A simple way to check for HTML strings
    // Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
    rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,

    // Match a standalone tag
    rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,

    // JSON RegExp
    rvalidchars = /^[\],:{}\s]*$/,
    rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g,
    rvalidescape = /\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,
    rvalidtokens = /"[^"\\\r\n]*"|true|false|null|-?(?:\d\d*\.|)\d+(?:[eE][\-+]?\d+|)/g,

    // Matches dashed string for camelizing
    rmsPrefix = /^-ms-/,
    rdashAlpha = /-([\da-z])/gi,

    // Used by jQuery.camelCase as callback to replace()
    fcamelCase = function( all, letter ) {
        return ( letter + "" ).toUpperCase();
    },

    // The ready event handler and self cleanup method
    DOMContentLoaded = function() {
        if ( document.addEventListener ) {
            document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
            jQuery.ready();
        } else if ( document.readyState === "complete" ) {
            // we're here because readyState === "complete" in oldIE
            // which is good enough for us to call the dom ready!
            document.detachEvent( "onreadystatechange", DOMContentLoaded );
            jQuery.ready();
        }
    },

    // [[Class]] -> type pairs
    class2type = {};

jQuery.fn = jQuery.prototype = {
    constructor: jQuery,
    init: function( selector, context, rootjQuery ) {
        var match, elem, ret, doc;

        // Handle $(""), $(null), $(undefined), $(false)
        if ( !selector ) {
            return this;
        }

        // Handle $(DOMElement)
        if ( selector.nodeType ) {
            this.context = this[0] = selector;
            this.length = 1;
            return this;
        }

        // Handle HTML strings
        if ( typeof selector === "string" ) {
            if ( selector.charAt(0) === "<" && selector.charAt( selector.length - 1 ) === ">" && selector.length >= 3 ) {
                // Assume that strings that start and end with <> are HTML and skip the regex check
                match = [ null, selector, null ];

            } else {
                match = rquickExpr.exec( selector );
            }

            // Match html or make sure no context is specified for #id
            if ( match && (match[1] || !context) ) {

                // HANDLE: $(html) -> $(array)
                if ( match[1] ) {
                    context = context instanceof jQuery ? context[0] : context;
                    doc = ( context && context.nodeType ? context.ownerDocument || context : document );

                    // scripts is true for back-compat
                    selector = jQuery.parseHTML( match[1], doc, true );
                    if ( rsingleTag.test( match[1] ) && jQuery.isPlainObject( context ) ) {
                        this.attr.call( selector, context, true );
                    }

                    return jQuery.merge( this, selector );

                // HANDLE: $(#id)
                } else {
                    elem = document.getElementById( match[2] );

                    // Check parentNode to catch when Blackberry 4.6 returns
                    // nodes that are no longer in the document #6963
                    if ( elem && elem.parentNode ) {
                        // Handle the case where IE and Opera return items
                        // by name instead of ID
                        if ( elem.id !== match[2] ) {
                            return rootjQuery.find( selector );
                        }

                        // Otherwise, we inject the element directly into the jQuery object
                        this.length = 1;
                        this[0] = elem;
                    }

                    this.context = document;
                    this.selector = selector;
                    return this;
                }

            // HANDLE: $(expr, $(...))
            } else if ( !context || context.jquery ) {
                return ( context || rootjQuery ).find( selector );

            // HANDLE: $(expr, context)
            // (which is just equivalent to: $(context).find(expr)
            } else {
                return this.constructor( context ).find( selector );
            }

        // HANDLE: $(function)
        // Shortcut for document ready
        } else if ( jQuery.isFunction( selector ) ) {
            return rootjQuery.ready( selector );
        }

        if ( selector.selector !== undefined ) {
            this.selector = selector.selector;
            this.context = selector.context;
        }

        return jQuery.makeArray( selector, this );
    },

    // Start with an empty selector
    selector: "",

    // The current version of jQuery being used
    jquery: "1.8.3",

    // The default length of a jQuery object is 0
    length: 0,

    // The number of elements contained in the matched element set
    size: function() {
        return this.length;
    },

    toArray: function() {
        return core_slice.call( this );
    },

    // Get the Nth element in the matched element set OR
    // Get the whole matched element set as a clean array
    get: function( num ) {
        return num == null ?

            // Return a 'clean' array
            this.toArray() :

            // Return just the object
            ( num < 0 ? this[ this.length + num ] : this[ num ] );
    },

    // Take an array of elements and push it onto the stack
    // (returning the new matched element set)
    pushStack: function( elems, name, selector ) {

        // Build a new jQuery matched element set
        var ret = jQuery.merge( this.constructor(), elems );

        // Add the old object onto the stack (as a reference)
        ret.prevObject = this;

        ret.context = this.context;

        if ( name === "find" ) {
            ret.selector = this.selector + ( this.selector ? " " : "" ) + selector;
        } else if ( name ) {
            ret.selector = this.selector + "." + name + "(" + selector + ")";
        }

        // Return the newly-formed element set
        return ret;
    },

    // Execute a callback for every element in the matched set.
    // (You can seed the arguments with an array of args, but this is
    // only used internally.)
    each: function( callback, args ) {
        return jQuery.each( this, callback, args );
    },

    ready: function( fn ) {
        // Add the callback
        jQuery.ready.promise().done( fn );

        return this;
    },

    eq: function( i ) {
        i = +i;
        return i === -1 ?
            this.slice( i ) :
            this.slice( i, i + 1 );
    },

    first: function() {
        return this.eq( 0 );
    },

    last: function() {
        return this.eq( -1 );
    },

    slice: function() {
        return this.pushStack( core_slice.apply( this, arguments ),
            "slice", core_slice.call(arguments).join(",") );
    },

    map: function( callback ) {
        return this.pushStack( jQuery.map(this, function( elem, i ) {
            return callback.call( elem, i, elem );
        }));
    },

    end: function() {
        return this.prevObject || this.constructor(null);
    },

    // For internal use only.
    // Behaves like an Array's method, not like a jQuery method.
    push: core_push,
    sort: [].sort,
    splice: [].splice
};

// Give the init function the jQuery prototype for later instantiation
jQuery.fn.init.prototype = jQuery.fn;

jQuery.extend = jQuery.fn.extend = function() {
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if ( typeof target === "boolean" ) {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
    }

    // Handle case when target is a string or something (possible in deep copy)
    if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
        target = {};
    }

    // extend jQuery itself if only one argument is passed
    if ( length === i ) {
        target = this;
        --i;
    }

    for ( ; i < length; i++ ) {
        // Only deal with non-null/undefined values
        if ( (options = arguments[ i ]) != null ) {
            // Extend the base object
            for ( name in options ) {
                src = target[ name ];
                copy = options[ name ];

                // Prevent never-ending loop
                if ( target === copy ) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
                    if ( copyIsArray ) {
                        copyIsArray = false;
                        clone = src && jQuery.isArray(src) ? src : [];

                    } else {
                        clone = src && jQuery.isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[ name ] = jQuery.extend( deep, clone, copy );

                // Don't bring in undefined values
                } else if ( copy !== undefined ) {
                    target[ name ] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};

jQuery.extend({
    noConflict: function( deep ) {
        if ( window.$ === jQuery ) {
            window.$ = _$;
        }

        if ( deep && window.jQuery === jQuery ) {
            window.jQuery = _jQuery;
        }

        return jQuery;
    },

    // Is the DOM ready to be used? Set to true once it occurs.
    isReady: false,

    // A counter to track how many items to wait for before
    // the ready event fires. See #6781
    readyWait: 1,

    // Hold (or release) the ready event
    holdReady: function( hold ) {
        if ( hold ) {
            jQuery.readyWait++;
        } else {
            jQuery.ready( true );
        }
    },

    // Handle when the DOM is ready
    ready: function( wait ) {

        // Abort if there are pending holds or we're already ready
        if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
            return;
        }

        // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
        if ( !document.body ) {
            return setTimeout( jQuery.ready, 1 );
        }

        // Remember that the DOM is ready
        jQuery.isReady = true;

        // If a normal DOM Ready event fired, decrement, and wait if need be
        if ( wait !== true && --jQuery.readyWait > 0 ) {
            return;
        }

        // If there are functions bound, to execute
        readyList.resolveWith( document, [ jQuery ] );

        // Trigger any bound ready events
        if ( jQuery.fn.trigger ) {
            jQuery( document ).trigger("ready").off("ready");
        }
    },

    // See test/unit/core.js for details concerning isFunction.
    // Since version 1.3, DOM methods and functions like alert
    // aren't supported. They return false on IE (#2968).
    isFunction: function( obj ) {
        return jQuery.type(obj) === "function";
    },

    isArray: Array.isArray || function( obj ) {
        return jQuery.type(obj) === "array";
    },

    isWindow: function( obj ) {
        return obj != null && obj == obj.window;
    },

    isNumeric: function( obj ) {
        return !isNaN( parseFloat(obj) ) && isFinite( obj );
    },

    type: function( obj ) {
        return obj == null ?
            String( obj ) :
            class2type[ core_toString.call(obj) ] || "object";
    },

    isPlainObject: function( obj ) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if ( !obj || jQuery.type(obj) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
            return false;
        }

        try {
            // Not own constructor property must be Object
            if ( obj.constructor &&
                !core_hasOwn.call(obj, "constructor") &&
                !core_hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
                return false;
            }
        } catch ( e ) {
            // IE8,9 Will throw exceptions on certain host objects #9897
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var key;
        for ( key in obj ) {}

        return key === undefined || core_hasOwn.call( obj, key );
    },

    isEmptyObject: function( obj ) {
        var name;
        for ( name in obj ) {
            return false;
        }
        return true;
    },

    error: function( msg ) {
        throw new Error( msg );
    },

    // data: string of html
    // context (optional): If specified, the fragment will be created in this context, defaults to document
    // scripts (optional): If true, will include scripts passed in the html string
    parseHTML: function( data, context, scripts ) {
        var parsed;
        if ( !data || typeof data !== "string" ) {
            return null;
        }
        if ( typeof context === "boolean" ) {
            scripts = context;
            context = 0;
        }
        context = context || document;

        // Single tag
        if ( (parsed = rsingleTag.exec( data )) ) {
            return [ context.createElement( parsed[1] ) ];
        }

        parsed = jQuery.buildFragment( [ data ], context, scripts ? null : [] );
        return jQuery.merge( [],
            (parsed.cacheable ? jQuery.clone( parsed.fragment ) : parsed.fragment).childNodes );
    },

    parseJSON: function( data ) {
        if ( !data || typeof data !== "string") {
            return null;
        }

        // Make sure leading/trailing whitespace is removed (IE can't handle it)
        data = jQuery.trim( data );

        // Attempt to parse using the native JSON parser first
        if ( window.JSON && window.JSON.parse ) {
            return window.JSON.parse( data );
        }

        // Make sure the incoming data is actual JSON
        // Logic borrowed from http://json.org/json2.js
        if ( rvalidchars.test( data.replace( rvalidescape, "@" )
            .replace( rvalidtokens, "]" )
            .replace( rvalidbraces, "")) ) {

            return ( new Function( "return " + data ) )();

        }
        jQuery.error( "Invalid JSON: " + data );
    },

    // Cross-browser xml parsing
    parseXML: function( data ) {
        var xml, tmp;
        if ( !data || typeof data !== "string" ) {
            return null;
        }
        try {
            if ( window.DOMParser ) { // Standard
                tmp = new DOMParser();
                xml = tmp.parseFromString( data , "text/xml" );
            } else { // IE
                xml = new ActiveXObject( "Microsoft.XMLDOM" );
                xml.async = "false";
                xml.loadXML( data );
            }
        } catch( e ) {
            xml = undefined;
        }
        if ( !xml || !xml.documentElement || xml.getElementsByTagName( "parsererror" ).length ) {
            jQuery.error( "Invalid XML: " + data );
        }
        return xml;
    },

    noop: function() {},

    // Evaluates a script in a global context
    // Workarounds based on findings by Jim Driscoll
    // http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
    globalEval: function( data ) {
        if ( data && core_rnotwhite.test( data ) ) {
            // We use execScript on Internet Explorer
            // We use an anonymous function so that context is window
            // rather than jQuery in Firefox
            ( window.execScript || function( data ) {
                window[ "eval" ].call( window, data );
            } )( data );
        }
    },

    // Convert dashed to camelCase; used by the css and data modules
    // Microsoft forgot to hump their vendor prefix (#9572)
    camelCase: function( string ) {
        return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
    },

    nodeName: function( elem, name ) {
        return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
    },

    // args is for internal usage only
    each: function( obj, callback, args ) {
        var name,
            i = 0,
            length = obj.length,
            isObj = length === undefined || jQuery.isFunction( obj );

        if ( args ) {
            if ( isObj ) {
                for ( name in obj ) {
                    if ( callback.apply( obj[ name ], args ) === false ) {
                        break;
                    }
                }
            } else {
                for ( ; i < length; ) {
                    if ( callback.apply( obj[ i++ ], args ) === false ) {
                        break;
                    }
                }
            }

        // A special, fast, case for the most common use of each
        } else {
            if ( isObj ) {
                for ( name in obj ) {
                    if ( callback.call( obj[ name ], name, obj[ name ] ) === false ) {
                        break;
                    }
                }
            } else {
                for ( ; i < length; ) {
                    if ( callback.call( obj[ i ], i, obj[ i++ ] ) === false ) {
                        break;
                    }
                }
            }
        }

        return obj;
    },

    // Use native String.trim function wherever possible
    trim: core_trim && !core_trim.call("\uFEFF\xA0") ?
        function( text ) {
            return text == null ?
                "" :
                core_trim.call( text );
        } :

        // Otherwise use our own trimming functionality
        function( text ) {
            return text == null ?
                "" :
                ( text + "" ).replace( rtrim, "" );
        },

    // results is for internal usage only
    makeArray: function( arr, results ) {
        var type,
            ret = results || [];

        if ( arr != null ) {
            // The window, strings (and functions) also have 'length'
            // Tweaked logic slightly to handle Blackberry 4.7 RegExp issues #6930
            type = jQuery.type( arr );

            if ( arr.length == null || type === "string" || type === "function" || type === "regexp" || jQuery.isWindow( arr ) ) {
                core_push.call( ret, arr );
            } else {
                jQuery.merge( ret, arr );
            }
        }

        return ret;
    },

    inArray: function( elem, arr, i ) {
        var len;

        if ( arr ) {
            if ( core_indexOf ) {
                return core_indexOf.call( arr, elem, i );
            }

            len = arr.length;
            i = i ? i < 0 ? Math.max( 0, len + i ) : i : 0;

            for ( ; i < len; i++ ) {
                // Skip accessing in sparse arrays
                if ( i in arr && arr[ i ] === elem ) {
                    return i;
                }
            }
        }

        return -1;
    },

    merge: function( first, second ) {
        var l = second.length,
            i = first.length,
            j = 0;

        if ( typeof l === "number" ) {
            for ( ; j < l; j++ ) {
                first[ i++ ] = second[ j ];
            }

        } else {
            while ( second[j] !== undefined ) {
                first[ i++ ] = second[ j++ ];
            }
        }

        first.length = i;

        return first;
    },

    grep: function( elems, callback, inv ) {
        var retVal,
            ret = [],
            i = 0,
            length = elems.length;
        inv = !!inv;

        // Go through the array, only saving the items
        // that pass the validator function
        for ( ; i < length; i++ ) {
            retVal = !!callback( elems[ i ], i );
            if ( inv !== retVal ) {
                ret.push( elems[ i ] );
            }
        }

        return ret;
    },

    // arg is for internal usage only
    map: function( elems, callback, arg ) {
        var value, key,
            ret = [],
            i = 0,
            length = elems.length,
            // jquery objects are treated as arrays
            isArray = elems instanceof jQuery || length !== undefined && typeof length === "number" && ( ( length > 0 && elems[ 0 ] && elems[ length -1 ] ) || length === 0 || jQuery.isArray( elems ) ) ;

        // Go through the array, translating each of the items to their
        if ( isArray ) {
            for ( ; i < length; i++ ) {
                value = callback( elems[ i ], i, arg );

                if ( value != null ) {
                    ret[ ret.length ] = value;
                }
            }

        // Go through every key on the object,
        } else {
            for ( key in elems ) {
                value = callback( elems[ key ], key, arg );

                if ( value != null ) {
                    ret[ ret.length ] = value;
                }
            }
        }

        // Flatten any nested arrays
        return ret.concat.apply( [], ret );
    },

    // A global GUID counter for objects
    guid: 1,

    // Bind a function to a context, optionally partially applying any
    // arguments.
    proxy: function( fn, context ) {
        var tmp, args, proxy;

        if ( typeof context === "string" ) {
            tmp = fn[ context ];
            context = fn;
            fn = tmp;
        }

        // Quick check to determine if target is callable, in the spec
        // this throws a TypeError, but we will just return undefined.
        if ( !jQuery.isFunction( fn ) ) {
            return undefined;
        }

        // Simulated bind
        args = core_slice.call( arguments, 2 );
        proxy = function() {
            return fn.apply( context, args.concat( core_slice.call( arguments ) ) );
        };

        // Set the guid of unique handler to the same of original handler, so it can be removed
        proxy.guid = fn.guid = fn.guid || jQuery.guid++;

        return proxy;
    },

    // Multifunctional method to get and set values of a collection
    // The value/s can optionally be executed if it's a function
    access: function( elems, fn, key, value, chainable, emptyGet, pass ) {
        var exec,
            bulk = key == null,
            i = 0,
            length = elems.length;

        // Sets many values
        if ( key && typeof key === "object" ) {
            for ( i in key ) {
                jQuery.access( elems, fn, i, key[i], 1, emptyGet, value );
            }
            chainable = 1;

        // Sets one value
        } else if ( value !== undefined ) {
            // Optionally, function values get executed if exec is true
            exec = pass === undefined && jQuery.isFunction( value );

            if ( bulk ) {
                // Bulk operations only iterate when executing function values
                if ( exec ) {
                    exec = fn;
                    fn = function( elem, key, value ) {
                        return exec.call( jQuery( elem ), value );
                    };

                // Otherwise they run against the entire set
                } else {
                    fn.call( elems, value );
                    fn = null;
                }
            }

            if ( fn ) {
                for (; i < length; i++ ) {
                    fn( elems[i], key, exec ? value.call( elems[i], i, fn( elems[i], key ) ) : value, pass );
                }
            }

            chainable = 1;
        }

        return chainable ?
            elems :

            // Gets
            bulk ?
                fn.call( elems ) :
                length ? fn( elems[0], key ) : emptyGet;
    },

    now: function() {
        return ( new Date() ).getTime();
    }
});

jQuery.ready.promise = function( obj ) {
    if ( !readyList ) {

        readyList = jQuery.Deferred();

        // Catch cases where $(document).ready() is called after the browser event has already occurred.
        // we once tried to use readyState "interactive" here, but it caused issues like the one
        // discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
        if ( document.readyState === "complete" ) {
            // Handle it asynchronously to allow scripts the opportunity to delay ready
            setTimeout( jQuery.ready, 1 );

        // Standards-based browsers support DOMContentLoaded
        } else if ( document.addEventListener ) {
            // Use the handy event callback
            document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );

            // A fallback to window.onload, that will always work
            window.addEventListener( "load", jQuery.ready, false );

        // If IE event model is used
        } else {
            // Ensure firing before onload, maybe late but safe also for iframes
            document.attachEvent( "onreadystatechange", DOMContentLoaded );

            // A fallback to window.onload, that will always work
            window.attachEvent( "onload", jQuery.ready );

            // If IE and not a frame
            // continually check to see if the document is ready
            var top = false;

            try {
                top = window.frameElement == null && document.documentElement;
            } catch(e) {}

            if ( top && top.doScroll ) {
                (function doScrollCheck() {
                    if ( !jQuery.isReady ) {

                        try {
                            // Use the trick by Diego Perini
                            // http://javascript.nwbox.com/IEContentLoaded/
                            top.doScroll("left");
                        } catch(e) {
                            return setTimeout( doScrollCheck, 50 );
                        }

                        // and execute any waiting functions
                        jQuery.ready();
                    }
                })();
            }
        }
    }
    return readyList.promise( obj );
};

// Populate the class2type map
jQuery.each("Boolean Number String Function Array Date RegExp Object".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase();
});

// All jQuery objects should point back to these
rootjQuery = jQuery(document);
// String to Object options format cache
var optionsCache = {};

// Convert String-formatted options into Object-formatted ones and store in cache
function createOptions( options ) {
    var object = optionsCache[ options ] = {};
    jQuery.each( options.split( core_rspace ), function( _, flag ) {
        object[ flag ] = true;
    });
    return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *  options: an optional list of space-separated options that will change how
 *          the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *  once:           will ensure the callback list can only be fired once (like a Deferred)
 *
 *  memory:         will keep track of previous values and will call any callback added
 *                  after the list has been fired right away with the latest "memorized"
 *                  values (like a Deferred)
 *
 *  unique:         will ensure a callback can only be added once (no duplicate in the list)
 *
 *  stopOnFalse:    interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

    // Convert options from String-formatted to Object-formatted if needed
    // (we check in cache first)
    options = typeof options === "string" ?
        ( optionsCache[ options ] || createOptions( options ) ) :
        jQuery.extend( {}, options );

    var // Last fire value (for non-forgettable lists)
        memory,
        // Flag to know if list was already fired
        fired,
        // Flag to know if list is currently firing
        firing,
        // First callback to fire (used internally by add and fireWith)
        firingStart,
        // End of the loop when firing
        firingLength,
        // Index of currently firing callback (modified by remove if needed)
        firingIndex,
        // Actual callback list
        list = [],
        // Stack of fire calls for repeatable lists
        stack = !options.once && [],
        // Fire callbacks
        fire = function( data ) {
            memory = options.memory && data;
            fired = true;
            firingIndex = firingStart || 0;
            firingStart = 0;
            firingLength = list.length;
            firing = true;
            for ( ; list && firingIndex < firingLength; firingIndex++ ) {
                if ( list[ firingIndex ].apply( data[ 0 ], data[ 1 ] ) === false && options.stopOnFalse ) {
                    memory = false; // To prevent further calls using add
                    break;
                }
            }
            firing = false;
            if ( list ) {
                if ( stack ) {
                    if ( stack.length ) {
                        fire( stack.shift() );
                    }
                } else if ( memory ) {
                    list = [];
                } else {
                    self.disable();
                }
            }
        },
        // Actual Callbacks object
        self = {
            // Add a callback or a collection of callbacks to the list
            add: function() {
                if ( list ) {
                    // First, we save the current length
                    var start = list.length;
                    (function add( args ) {
                        jQuery.each( args, function( _, arg ) {
                            var type = jQuery.type( arg );
                            if ( type === "function" ) {
                                if ( !options.unique || !self.has( arg ) ) {
                                    list.push( arg );
                                }
                            } else if ( arg && arg.length && type !== "string" ) {
                                // Inspect recursively
                                add( arg );
                            }
                        });
                    })( arguments );
                    // Do we need to add the callbacks to the
                    // current firing batch?
                    if ( firing ) {
                        firingLength = list.length;
                    // With memory, if we're not firing then
                    // we should call right away
                    } else if ( memory ) {
                        firingStart = start;
                        fire( memory );
                    }
                }
                return this;
            },
            // Remove a callback from the list
            remove: function() {
                if ( list ) {
                    jQuery.each( arguments, function( _, arg ) {
                        var index;
                        while( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
                            list.splice( index, 1 );
                            // Handle firing indexes
                            if ( firing ) {
                                if ( index <= firingLength ) {
                                    firingLength--;
                                }
                                if ( index <= firingIndex ) {
                                    firingIndex--;
                                }
                            }
                        }
                    });
                }
                return this;
            },
            // Control if a given callback is in the list
            has: function( fn ) {
                return jQuery.inArray( fn, list ) > -1;
            },
            // Remove all callbacks from the list
            empty: function() {
                list = [];
                return this;
            },
            // Have the list do nothing anymore
            disable: function() {
                list = stack = memory = undefined;
                return this;
            },
            // Is it disabled?
            disabled: function() {
                return !list;
            },
            // Lock the list in its current state
            lock: function() {
                stack = undefined;
                if ( !memory ) {
                    self.disable();
                }
                return this;
            },
            // Is it locked?
            locked: function() {
                return !stack;
            },
            // Call all callbacks with the given context and arguments
            fireWith: function( context, args ) {
                args = args || [];
                args = [ context, args.slice ? args.slice() : args ];
                if ( list && ( !fired || stack ) ) {
                    if ( firing ) {
                        stack.push( args );
                    } else {
                        fire( args );
                    }
                }
                return this;
            },
            // Call all the callbacks with the given arguments
            fire: function() {
                self.fireWith( this, arguments );
                return this;
            },
            // To know if the callbacks have already been called at least once
            fired: function() {
                return !!fired;
            }
        };

    return self;
};
jQuery.extend({

    Deferred: function( func ) {
        var tuples = [
                // action, add listener, listener list, final state
                [ "resolve", "done", jQuery.Callbacks("once memory"), "resolved" ],
                [ "reject", "fail", jQuery.Callbacks("once memory"), "rejected" ],
                [ "notify", "progress", jQuery.Callbacks("memory") ]
            ],
            state = "pending",
            promise = {
                state: function() {
                    return state;
                },
                always: function() {
                    deferred.done( arguments ).fail( arguments );
                    return this;
                },
                then: function( /* fnDone, fnFail, fnProgress */ ) {
                    var fns = arguments;
                    return jQuery.Deferred(function( newDefer ) {
                        jQuery.each( tuples, function( i, tuple ) {
                            var action = tuple[ 0 ],
                                fn = fns[ i ];
                            // deferred[ done | fail | progress ] for forwarding actions to newDefer
                            deferred[ tuple[1] ]( jQuery.isFunction( fn ) ?
                                function() {
                                    var returned = fn.apply( this, arguments );
                                    if ( returned && jQuery.isFunction( returned.promise ) ) {
                                        returned.promise()
                                            .done( newDefer.resolve )
                                            .fail( newDefer.reject )
                                            .progress( newDefer.notify );
                                    } else {
                                        newDefer[ action + "With" ]( this === deferred ? newDefer : this, [ returned ] );
                                    }
                                } :
                                newDefer[ action ]
                            );
                        });
                        fns = null;
                    }).promise();
                },
                // Get a promise for this deferred
                // If obj is provided, the promise aspect is added to the object
                promise: function( obj ) {
                    return obj != null ? jQuery.extend( obj, promise ) : promise;
                }
            },
            deferred = {};

        // Keep pipe for back-compat
        promise.pipe = promise.then;

        // Add list-specific methods
        jQuery.each( tuples, function( i, tuple ) {
            var list = tuple[ 2 ],
                stateString = tuple[ 3 ];

            // promise[ done | fail | progress ] = list.add
            promise[ tuple[1] ] = list.add;

            // Handle state
            if ( stateString ) {
                list.add(function() {
                    // state = [ resolved | rejected ]
                    state = stateString;

                // [ reject_list | resolve_list ].disable; progress_list.lock
                }, tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock );
            }

            // deferred[ resolve | reject | notify ] = list.fire
            deferred[ tuple[0] ] = list.fire;
            deferred[ tuple[0] + "With" ] = list.fireWith;
        });

        // Make the deferred a promise
        promise.promise( deferred );

        // Call given func if any
        if ( func ) {
            func.call( deferred, deferred );
        }

        // All done!
        return deferred;
    },

    // Deferred helper
    when: function( subordinate /* , ..., subordinateN */ ) {
        var i = 0,
            resolveValues = core_slice.call( arguments ),
            length = resolveValues.length,

            // the count of uncompleted subordinates
            remaining = length !== 1 || ( subordinate && jQuery.isFunction( subordinate.promise ) ) ? length : 0,

            // the master Deferred. If resolveValues consist of only a single Deferred, just use that.
            deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

            // Update function for both resolve and progress values
            updateFunc = function( i, contexts, values ) {
                return function( value ) {
                    contexts[ i ] = this;
                    values[ i ] = arguments.length > 1 ? core_slice.call( arguments ) : value;
                    if( values === progressValues ) {
                        deferred.notifyWith( contexts, values );
                    } else if ( !( --remaining ) ) {
                        deferred.resolveWith( contexts, values );
                    }
                };
            },

            progressValues, progressContexts, resolveContexts;

        // add listeners to Deferred subordinates; treat others as resolved
        if ( length > 1 ) {
            progressValues = new Array( length );
            progressContexts = new Array( length );
            resolveContexts = new Array( length );
            for ( ; i < length; i++ ) {
                if ( resolveValues[ i ] && jQuery.isFunction( resolveValues[ i ].promise ) ) {
                    resolveValues[ i ].promise()
                        .done( updateFunc( i, resolveContexts, resolveValues ) )
                        .fail( deferred.reject )
                        .progress( updateFunc( i, progressContexts, progressValues ) );
                } else {
                    --remaining;
                }
            }
        }

        // if we're not waiting on anything, resolve the master
        if ( !remaining ) {
            deferred.resolveWith( resolveContexts, resolveValues );
        }

        return deferred.promise();
    }
});
jQuery.support = (function() {

    var support,
        all,
        a,
        select,
        opt,
        input,
        fragment,
        eventName,
        i,
        isSupported,
        clickFn,
        div = document.createElement("div");

    // Setup
    div.setAttribute( "className", "t" );
    div.innerHTML = "  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>";

    // Support tests won't run in some limited or non-browser environments
    all = div.getElementsByTagName("*");
    a = div.getElementsByTagName("a")[ 0 ];
    if ( !all || !a || !all.length ) {
        return {};
    }

    // First batch of tests
    select = document.createElement("select");
    opt = select.appendChild( document.createElement("option") );
    input = div.getElementsByTagName("input")[ 0 ];

    a.style.cssText = "top:1px;float:left;opacity:.5";
    support = {
        // IE strips leading whitespace when .innerHTML is used
        leadingWhitespace: ( div.firstChild.nodeType === 3 ),

        // Make sure that tbody elements aren't automatically inserted
        // IE will insert them into empty tables
        tbody: !div.getElementsByTagName("tbody").length,

        // Make sure that link elements get serialized correctly by innerHTML
        // This requires a wrapper element in IE
        htmlSerialize: !!div.getElementsByTagName("link").length,

        // Get the style information from getAttribute
        // (IE uses .cssText instead)
        style: /top/.test( a.getAttribute("style") ),

        // Make sure that URLs aren't manipulated
        // (IE normalizes it by default)
        hrefNormalized: ( a.getAttribute("href") === "/a" ),

        // Make sure that element opacity exists
        // (IE uses filter instead)
        // Use a regex to work around a WebKit issue. See #5145
        opacity: /^0.5/.test( a.style.opacity ),

        // Verify style float existence
        // (IE uses styleFloat instead of cssFloat)
        cssFloat: !!a.style.cssFloat,

        // Make sure that if no value is specified for a checkbox
        // that it defaults to "on".
        // (WebKit defaults to "" instead)
        checkOn: ( input.value === "on" ),

        // Make sure that a selected-by-default option has a working selected property.
        // (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
        optSelected: opt.selected,

        // Test setAttribute on camelCase class. If it works, we need attrFixes when doing get/setAttribute (ie6/7)
        getSetAttribute: div.className !== "t",

        // Tests for enctype support on a form (#6743)
        enctype: !!document.createElement("form").enctype,

        // Makes sure cloning an html5 element does not cause problems
        // Where outerHTML is undefined, this still works
        html5Clone: document.createElement("nav").cloneNode( true ).outerHTML !== "<:nav></:nav>",

        // jQuery.support.boxModel DEPRECATED in 1.8 since we don't support Quirks Mode
        boxModel: ( document.compatMode === "CSS1Compat" ),

        // Will be defined later
        submitBubbles: true,
        changeBubbles: true,
        focusinBubbles: false,
        deleteExpando: true,
        noCloneEvent: true,
        inlineBlockNeedsLayout: false,
        shrinkWrapBlocks: false,
        reliableMarginRight: true,
        boxSizingReliable: true,
        pixelPosition: false
    };

    // Make sure checked status is properly cloned
    input.checked = true;
    support.noCloneChecked = input.cloneNode( true ).checked;

    // Make sure that the options inside disabled selects aren't marked as disabled
    // (WebKit marks them as disabled)
    select.disabled = true;
    support.optDisabled = !opt.disabled;

    // Test to see if it's possible to delete an expando from an element
    // Fails in Internet Explorer
    try {
        delete div.test;
    } catch( e ) {
        support.deleteExpando = false;
    }

    if ( !div.addEventListener && div.attachEvent && div.fireEvent ) {
        div.attachEvent( "onclick", clickFn = function() {
            // Cloning a node shouldn't copy over any
            // bound event handlers (IE does this)
            support.noCloneEvent = false;
        });
        div.cloneNode( true ).fireEvent("onclick");
        div.detachEvent( "onclick", clickFn );
    }

    // Check if a radio maintains its value
    // after being appended to the DOM
    input = document.createElement("input");
    input.value = "t";
    input.setAttribute( "type", "radio" );
    support.radioValue = input.value === "t";

    input.setAttribute( "checked", "checked" );

    // #11217 - WebKit loses check when the name is after the checked attribute
    input.setAttribute( "name", "t" );

    div.appendChild( input );
    fragment = document.createDocumentFragment();
    fragment.appendChild( div.lastChild );

    // WebKit doesn't clone checked state correctly in fragments
    support.checkClone = fragment.cloneNode( true ).cloneNode( true ).lastChild.checked;

    // Check if a disconnected checkbox will retain its checked
    // value of true after appended to the DOM (IE6/7)
    support.appendChecked = input.checked;

    fragment.removeChild( input );
    fragment.appendChild( div );

    // Technique from Juriy Zaytsev
    // http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
    // We only care about the case where non-standard event systems
    // are used, namely in IE. Short-circuiting here helps us to
    // avoid an eval call (in setAttribute) which can cause CSP
    // to go haywire. See: https://developer.mozilla.org/en/Security/CSP
    if ( div.attachEvent ) {
        for ( i in {
            submit: true,
            change: true,
            focusin: true
        }) {
            eventName = "on" + i;
            isSupported = ( eventName in div );
            if ( !isSupported ) {
                div.setAttribute( eventName, "return;" );
                isSupported = ( typeof div[ eventName ] === "function" );
            }
            support[ i + "Bubbles" ] = isSupported;
        }
    }

    // Run tests that need a body at doc ready
    jQuery(function() {
        var container, div, tds, marginDiv,
            divReset = "padding:0;margin:0;border:0;display:block;overflow:hidden;",
            body = document.getElementsByTagName("body")[0];

        if ( !body ) {
            // Return for frameset docs that don't have a body
            return;
        }

        container = document.createElement("div");
        container.style.cssText = "visibility:hidden;border:0;width:0;height:0;position:static;top:0;margin-top:1px";
        body.insertBefore( container, body.firstChild );

        // Construct the test element
        div = document.createElement("div");
        container.appendChild( div );

        // Check if table cells still have offsetWidth/Height when they are set
        // to display:none and there are still other visible table cells in a
        // table row; if so, offsetWidth/Height are not reliable for use when
        // determining if an element has been hidden directly using
        // display:none (it is still safe to use offsets if a parent element is
        // hidden; don safety goggles and see bug #4512 for more information).
        // (only IE 8 fails this test)
        div.innerHTML = "<table><tr><td></td><td>t</td></tr></table>";
        tds = div.getElementsByTagName("td");
        tds[ 0 ].style.cssText = "padding:0;margin:0;border:0;display:none";
        isSupported = ( tds[ 0 ].offsetHeight === 0 );

        tds[ 0 ].style.display = "";
        tds[ 1 ].style.display = "none";

        // Check if empty table cells still have offsetWidth/Height
        // (IE <= 8 fail this test)
        support.reliableHiddenOffsets = isSupported && ( tds[ 0 ].offsetHeight === 0 );

        // Check box-sizing and margin behavior
        div.innerHTML = "";
        div.style.cssText = "box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;";
        support.boxSizing = ( div.offsetWidth === 4 );
        support.doesNotIncludeMarginInBodyOffset = ( body.offsetTop !== 1 );

        // NOTE: To any future maintainer, we've window.getComputedStyle
        // because jsdom on node.js will break without it.
        if ( window.getComputedStyle ) {
            support.pixelPosition = ( window.getComputedStyle( div, null ) || {} ).top !== "1%";
            support.boxSizingReliable = ( window.getComputedStyle( div, null ) || { width: "4px" } ).width === "4px";

            // Check if div with explicit width and no margin-right incorrectly
            // gets computed margin-right based on width of container. For more
            // info see bug #3333
            // Fails in WebKit before Feb 2011 nightlies
            // WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
            marginDiv = document.createElement("div");
            marginDiv.style.cssText = div.style.cssText = divReset;
            marginDiv.style.marginRight = marginDiv.style.width = "0";
            div.style.width = "1px";
            div.appendChild( marginDiv );
            support.reliableMarginRight =
                !parseFloat( ( window.getComputedStyle( marginDiv, null ) || {} ).marginRight );
        }

        if ( typeof div.style.zoom !== "undefined" ) {
            // Check if natively block-level elements act like inline-block
            // elements when setting their display to 'inline' and giving
            // them layout
            // (IE < 8 does this)
            div.innerHTML = "";
            div.style.cssText = divReset + "width:1px;padding:1px;display:inline;zoom:1";
            support.inlineBlockNeedsLayout = ( div.offsetWidth === 3 );

            // Check if elements with layout shrink-wrap their children
            // (IE 6 does this)
            div.style.display = "block";
            div.style.overflow = "visible";
            div.innerHTML = "<div></div>";
            div.firstChild.style.width = "5px";
            support.shrinkWrapBlocks = ( div.offsetWidth !== 3 );

            container.style.zoom = 1;
        }

        // Null elements to avoid leaks in IE
        body.removeChild( container );
        container = div = tds = marginDiv = null;
    });

    // Null elements to avoid leaks in IE
    fragment.removeChild( div );
    all = a = select = opt = input = fragment = div = null;

    return support;
})();
var rbrace = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/,
    rmultiDash = /([A-Z])/g;

jQuery.extend({
    cache: {},

    deletedIds: [],

    // Remove at next major release (1.9/2.0)
    uuid: 0,

    // Unique for each copy of jQuery on the page
    // Non-digits removed to match rinlinejQuery
    expando: "jQuery" + ( jQuery.fn.jquery + Math.random() ).replace( /\D/g, "" ),

    // The following elements throw uncatchable exceptions if you
    // attempt to add expando properties to them.
    noData: {
        "embed": true,
        // Ban all objects except for Flash (which handle expandos)
        "object": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
        "applet": true
    },

    hasData: function( elem ) {
        elem = elem.nodeType ? jQuery.cache[ elem[jQuery.expando] ] : elem[ jQuery.expando ];
        return !!elem && !isEmptyDataObject( elem );
    },

    data: function( elem, name, data, pvt /* Internal Use Only */ ) {
        if ( !jQuery.acceptData( elem ) ) {
            return;
        }

        var thisCache, ret,
            internalKey = jQuery.expando,
            getByName = typeof name === "string",

            // We have to handle DOM nodes and JS objects differently because IE6-7
            // can't GC object references properly across the DOM-JS boundary
            isNode = elem.nodeType,

            // Only DOM nodes need the global jQuery cache; JS object data is
            // attached directly to the object so GC can occur automatically
            cache = isNode ? jQuery.cache : elem,

            // Only defining an ID for JS objects if its cache already exists allows
            // the code to shortcut on the same path as a DOM node with no cache
            id = isNode ? elem[ internalKey ] : elem[ internalKey ] && internalKey;

        // Avoid doing any more work than we need to when trying to get data on an
        // object that has no data at all
        if ( (!id || !cache[id] || (!pvt && !cache[id].data)) && getByName && data === undefined ) {
            return;
        }

        if ( !id ) {
            // Only DOM nodes need a new unique ID for each element since their data
            // ends up in the global cache
            if ( isNode ) {
                elem[ internalKey ] = id = jQuery.deletedIds.pop() || jQuery.guid++;
            } else {
                id = internalKey;
            }
        }

        if ( !cache[ id ] ) {
            cache[ id ] = {};

            // Avoids exposing jQuery metadata on plain JS objects when the object
            // is serialized using JSON.stringify
            if ( !isNode ) {
                cache[ id ].toJSON = jQuery.noop;
            }
        }

        // An object can be passed to jQuery.data instead of a key/value pair; this gets
        // shallow copied over onto the existing cache
        if ( typeof name === "object" || typeof name === "function" ) {
            if ( pvt ) {
                cache[ id ] = jQuery.extend( cache[ id ], name );
            } else {
                cache[ id ].data = jQuery.extend( cache[ id ].data, name );
            }
        }

        thisCache = cache[ id ];

        // jQuery data() is stored in a separate object inside the object's internal data
        // cache in order to avoid key collisions between internal data and user-defined
        // data.
        if ( !pvt ) {
            if ( !thisCache.data ) {
                thisCache.data = {};
            }

            thisCache = thisCache.data;
        }

        if ( data !== undefined ) {
            thisCache[ jQuery.camelCase( name ) ] = data;
        }

        // Check for both converted-to-camel and non-converted data property names
        // If a data property was specified
        if ( getByName ) {

            // First Try to find as-is property data
            ret = thisCache[ name ];

            // Test for null|undefined property data
            if ( ret == null ) {

                // Try to find the camelCased property
                ret = thisCache[ jQuery.camelCase( name ) ];
            }
        } else {
            ret = thisCache;
        }

        return ret;
    },

    removeData: function( elem, name, pvt /* Internal Use Only */ ) {
        if ( !jQuery.acceptData( elem ) ) {
            return;
        }

        var thisCache, i, l,

            isNode = elem.nodeType,

            // See jQuery.data for more information
            cache = isNode ? jQuery.cache : elem,
            id = isNode ? elem[ jQuery.expando ] : jQuery.expando;

        // If there is already no cache entry for this object, there is no
        // purpose in continuing
        if ( !cache[ id ] ) {
            return;
        }

        if ( name ) {

            thisCache = pvt ? cache[ id ] : cache[ id ].data;

            if ( thisCache ) {

                // Support array or space separated string names for data keys
                if ( !jQuery.isArray( name ) ) {

                    // try the string as a key before any manipulation
                    if ( name in thisCache ) {
                        name = [ name ];
                    } else {

                        // split the camel cased version by spaces unless a key with the spaces exists
                        name = jQuery.camelCase( name );
                        if ( name in thisCache ) {
                            name = [ name ];
                        } else {
                            name = name.split(" ");
                        }
                    }
                }

                for ( i = 0, l = name.length; i < l; i++ ) {
                    delete thisCache[ name[i] ];
                }

                // If there is no data left in the cache, we want to continue
                // and let the cache object itself get destroyed
                if ( !( pvt ? isEmptyDataObject : jQuery.isEmptyObject )( thisCache ) ) {
                    return;
                }
            }
        }

        // See jQuery.data for more information
        if ( !pvt ) {
            delete cache[ id ].data;

            // Don't destroy the parent cache unless the internal data object
            // had been the only thing left in it
            if ( !isEmptyDataObject( cache[ id ] ) ) {
                return;
            }
        }

        // Destroy the cache
        if ( isNode ) {
            jQuery.cleanData( [ elem ], true );

        // Use delete when supported for expandos or `cache` is not a window per isWindow (#10080)
        } else if ( jQuery.support.deleteExpando || cache != cache.window ) {
            delete cache[ id ];

        // When all else fails, null
        } else {
            cache[ id ] = null;
        }
    },

    // For internal use only.
    _data: function( elem, name, data ) {
        return jQuery.data( elem, name, data, true );
    },

    // A method for determining if a DOM node can handle the data expando
    acceptData: function( elem ) {
        var noData = elem.nodeName && jQuery.noData[ elem.nodeName.toLowerCase() ];

        // nodes accept data unless otherwise specified; rejection can be conditional
        return !noData || noData !== true && elem.getAttribute("classid") === noData;
    }
});

jQuery.fn.extend({
    data: function( key, value ) {
        var parts, part, attr, name, l,
            elem = this[0],
            i = 0,
            data = null;

        // Gets all values
        if ( key === undefined ) {
            if ( this.length ) {
                data = jQuery.data( elem );

                if ( elem.nodeType === 1 && !jQuery._data( elem, "parsedAttrs" ) ) {
                    attr = elem.attributes;
                    for ( l = attr.length; i < l; i++ ) {
                        name = attr[i].name;

                        if ( !name.indexOf( "data-" ) ) {
                            name = jQuery.camelCase( name.substring(5) );

                            dataAttr( elem, name, data[ name ] );
                        }
                    }
                    jQuery._data( elem, "parsedAttrs", true );
                }
            }

            return data;
        }

        // Sets multiple values
        if ( typeof key === "object" ) {
            return this.each(function() {
                jQuery.data( this, key );
            });
        }

        parts = key.split( ".", 2 );
        parts[1] = parts[1] ? "." + parts[1] : "";
        part = parts[1] + "!";

        return jQuery.access( this, function( value ) {

            if ( value === undefined ) {
                data = this.triggerHandler( "getData" + part, [ parts[0] ] );

                // Try to fetch any internally stored data first
                if ( data === undefined && elem ) {
                    data = jQuery.data( elem, key );
                    data = dataAttr( elem, key, data );
                }

                return data === undefined && parts[1] ?
                    this.data( parts[0] ) :
                    data;
            }

            parts[1] = value;
            this.each(function() {
                var self = jQuery( this );

                self.triggerHandler( "setData" + part, parts );
                jQuery.data( this, key, value );
                self.triggerHandler( "changeData" + part, parts );
            });
        }, null, value, arguments.length > 1, null, false );
    },

    removeData: function( key ) {
        return this.each(function() {
            jQuery.removeData( this, key );
        });
    }
});

function dataAttr( elem, key, data ) {
    // If nothing was found internally, try to fetch any
    // data from the HTML5 data-* attribute
    if ( data === undefined && elem.nodeType === 1 ) {

        var name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();

        data = elem.getAttribute( name );

        if ( typeof data === "string" ) {
            try {
                data = data === "true" ? true :
                data === "false" ? false :
                data === "null" ? null :
                // Only convert to a number if it doesn't change the string
                +data + "" === data ? +data :
                rbrace.test( data ) ? jQuery.parseJSON( data ) :
                    data;
            } catch( e ) {}

            // Make sure we set the data so it isn't changed later
            jQuery.data( elem, key, data );

        } else {
            data = undefined;
        }
    }

    return data;
}

// checks a cache object for emptiness
function isEmptyDataObject( obj ) {
    var name;
    for ( name in obj ) {

        // if the public data object is empty, the private is still empty
        if ( name === "data" && jQuery.isEmptyObject( obj[name] ) ) {
            continue;
        }
        if ( name !== "toJSON" ) {
            return false;
        }
    }

    return true;
}
jQuery.extend({
    queue: function( elem, type, data ) {
        var queue;

        if ( elem ) {
            type = ( type || "fx" ) + "queue";
            queue = jQuery._data( elem, type );

            // Speed up dequeue by getting out quickly if this is just a lookup
            if ( data ) {
                if ( !queue || jQuery.isArray(data) ) {
                    queue = jQuery._data( elem, type, jQuery.makeArray(data) );
                } else {
                    queue.push( data );
                }
            }
            return queue || [];
        }
    },

    dequeue: function( elem, type ) {
        type = type || "fx";

        var queue = jQuery.queue( elem, type ),
            startLength = queue.length,
            fn = queue.shift(),
            hooks = jQuery._queueHooks( elem, type ),
            next = function() {
                jQuery.dequeue( elem, type );
            };

        // If the fx queue is dequeued, always remove the progress sentinel
        if ( fn === "inprogress" ) {
            fn = queue.shift();
            startLength--;
        }

        if ( fn ) {

            // Add a progress sentinel to prevent the fx queue from being
            // automatically dequeued
            if ( type === "fx" ) {
                queue.unshift( "inprogress" );
            }

            // clear up the last queue stop function
            delete hooks.stop;
            fn.call( elem, next, hooks );
        }

        if ( !startLength && hooks ) {
            hooks.empty.fire();
        }
    },

    // not intended for public consumption - generates a queueHooks object, or returns the current one
    _queueHooks: function( elem, type ) {
        var key = type + "queueHooks";
        return jQuery._data( elem, key ) || jQuery._data( elem, key, {
            empty: jQuery.Callbacks("once memory").add(function() {
                jQuery.removeData( elem, type + "queue", true );
                jQuery.removeData( elem, key, true );
            })
        });
    }
});

jQuery.fn.extend({
    queue: function( type, data ) {
        var setter = 2;

        if ( typeof type !== "string" ) {
            data = type;
            type = "fx";
            setter--;
        }

        if ( arguments.length < setter ) {
            return jQuery.queue( this[0], type );
        }

        return data === undefined ?
            this :
            this.each(function() {
                var queue = jQuery.queue( this, type, data );

                // ensure a hooks for this queue
                jQuery._queueHooks( this, type );

                if ( type === "fx" && queue[0] !== "inprogress" ) {
                    jQuery.dequeue( this, type );
                }
            });
    },
    dequeue: function( type ) {
        return this.each(function() {
            jQuery.dequeue( this, type );
        });
    },
    // Based off of the plugin by Clint Helfers, with permission.
    // http://blindsignals.com/index.php/2009/07/jquery-delay/
    delay: function( time, type ) {
        time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
        type = type || "fx";

        return this.queue( type, function( next, hooks ) {
            var timeout = setTimeout( next, time );
            hooks.stop = function() {
                clearTimeout( timeout );
            };
        });
    },
    clearQueue: function( type ) {
        return this.queue( type || "fx", [] );
    },
    // Get a promise resolved when queues of a certain type
    // are emptied (fx is the type by default)
    promise: function( type, obj ) {
        var tmp,
            count = 1,
            defer = jQuery.Deferred(),
            elements = this,
            i = this.length,
            resolve = function() {
                if ( !( --count ) ) {
                    defer.resolveWith( elements, [ elements ] );
                }
            };

        if ( typeof type !== "string" ) {
            obj = type;
            type = undefined;
        }
        type = type || "fx";

        while( i-- ) {
            tmp = jQuery._data( elements[ i ], type + "queueHooks" );
            if ( tmp && tmp.empty ) {
                count++;
                tmp.empty.add( resolve );
            }
        }
        resolve();
        return defer.promise( obj );
    }
});
var nodeHook, boolHook, fixSpecified,
    rclass = /[\t\r\n]/g,
    rreturn = /\r/g,
    rtype = /^(?:button|input)$/i,
    rfocusable = /^(?:button|input|object|select|textarea)$/i,
    rclickable = /^a(?:rea|)$/i,
    rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,
    getSetAttribute = jQuery.support.getSetAttribute;

jQuery.fn.extend({
    attr: function( name, value ) {
        return jQuery.access( this, jQuery.attr, name, value, arguments.length > 1 );
    },

    removeAttr: function( name ) {
        return this.each(function() {
            jQuery.removeAttr( this, name );
        });
    },

    prop: function( name, value ) {
        return jQuery.access( this, jQuery.prop, name, value, arguments.length > 1 );
    },

    removeProp: function( name ) {
        name = jQuery.propFix[ name ] || name;
        return this.each(function() {
            // try/catch handles cases where IE balks (such as removing a property on window)
            try {
                this[ name ] = undefined;
                delete this[ name ];
            } catch( e ) {}
        });
    },

    addClass: function( value ) {
        var classNames, i, l, elem,
            setClass, c, cl;

        if ( jQuery.isFunction( value ) ) {
            return this.each(function( j ) {
                jQuery( this ).addClass( value.call(this, j, this.className) );
            });
        }

        if ( value && typeof value === "string" ) {
            classNames = value.split( core_rspace );

            for ( i = 0, l = this.length; i < l; i++ ) {
                elem = this[ i ];

                if ( elem.nodeType === 1 ) {
                    if ( !elem.className && classNames.length === 1 ) {
                        elem.className = value;

                    } else {
                        setClass = " " + elem.className + " ";

                        for ( c = 0, cl = classNames.length; c < cl; c++ ) {
                            if ( setClass.indexOf( " " + classNames[ c ] + " " ) < 0 ) {
                                setClass += classNames[ c ] + " ";
                            }
                        }
                        elem.className = jQuery.trim( setClass );
                    }
                }
            }
        }

        return this;
    },

    removeClass: function( value ) {
        var removes, className, elem, c, cl, i, l;

        if ( jQuery.isFunction( value ) ) {
            return this.each(function( j ) {
                jQuery( this ).removeClass( value.call(this, j, this.className) );
            });
        }
        if ( (value && typeof value === "string") || value === undefined ) {
            removes = ( value || "" ).split( core_rspace );

            for ( i = 0, l = this.length; i < l; i++ ) {
                elem = this[ i ];
                if ( elem.nodeType === 1 && elem.className ) {

                    className = (" " + elem.className + " ").replace( rclass, " " );

                    // loop over each item in the removal list
                    for ( c = 0, cl = removes.length; c < cl; c++ ) {
                        // Remove until there is nothing to remove,
                        while ( className.indexOf(" " + removes[ c ] + " ") >= 0 ) {
                            className = className.replace( " " + removes[ c ] + " " , " " );
                        }
                    }
                    elem.className = value ? jQuery.trim( className ) : "";
                }
            }
        }

        return this;
    },

    toggleClass: function( value, stateVal ) {
        var type = typeof value,
            isBool = typeof stateVal === "boolean";

        if ( jQuery.isFunction( value ) ) {
            return this.each(function( i ) {
                jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
            });
        }

        return this.each(function() {
            if ( type === "string" ) {
                // toggle individual class names
                var className,
                    i = 0,
                    self = jQuery( this ),
                    state = stateVal,
                    classNames = value.split( core_rspace );

                while ( (className = classNames[ i++ ]) ) {
                    // check each className given, space separated list
                    state = isBool ? state : !self.hasClass( className );
                    self[ state ? "addClass" : "removeClass" ]( className );
                }

            } else if ( type === "undefined" || type === "boolean" ) {
                if ( this.className ) {
                    // store className if set
                    jQuery._data( this, "__className__", this.className );
                }

                // toggle whole className
                this.className = this.className || value === false ? "" : jQuery._data( this, "__className__" ) || "";
            }
        });
    },

    hasClass: function( selector ) {
        var className = " " + selector + " ",
            i = 0,
            l = this.length;
        for ( ; i < l; i++ ) {
            if ( this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) >= 0 ) {
                return true;
            }
        }

        return false;
    },

    val: function( value ) {
        var hooks, ret, isFunction,
            elem = this[0];

        if ( !arguments.length ) {
            if ( elem ) {
                hooks = jQuery.valHooks[ elem.type ] || jQuery.valHooks[ elem.nodeName.toLowerCase() ];

                if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
                    return ret;
                }

                ret = elem.value;

                return typeof ret === "string" ?
                    // handle most common string cases
                    ret.replace(rreturn, "") :
                    // handle cases where value is null/undef or number
                    ret == null ? "" : ret;
            }

            return;
        }

        isFunction = jQuery.isFunction( value );

        return this.each(function( i ) {
            var val,
                self = jQuery(this);

            if ( this.nodeType !== 1 ) {
                return;
            }

            if ( isFunction ) {
                val = value.call( this, i, self.val() );
            } else {
                val = value;
            }

            // Treat null/undefined as ""; convert numbers to string
            if ( val == null ) {
                val = "";
            } else if ( typeof val === "number" ) {
                val += "";
            } else if ( jQuery.isArray( val ) ) {
                val = jQuery.map(val, function ( value ) {
                    return value == null ? "" : value + "";
                });
            }

            hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

            // If set returns undefined, fall back to normal setting
            if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
                this.value = val;
            }
        });
    }
});

jQuery.extend({
    valHooks: {
        option: {
            get: function( elem ) {
                // attributes.value is undefined in Blackberry 4.7 but
                // uses .value. See #6932
                var val = elem.attributes.value;
                return !val || val.specified ? elem.value : elem.text;
            }
        },
        select: {
            get: function( elem ) {
                var value, option,
                    options = elem.options,
                    index = elem.selectedIndex,
                    one = elem.type === "select-one" || index < 0,
                    values = one ? null : [],
                    max = one ? index + 1 : options.length,
                    i = index < 0 ?
                        max :
                        one ? index : 0;

                // Loop through all the selected options
                for ( ; i < max; i++ ) {
                    option = options[ i ];

                    // oldIE doesn't update selected after form reset (#2551)
                    if ( ( option.selected || i === index ) &&
                            // Don't return options that are disabled or in a disabled optgroup
                            ( jQuery.support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null ) &&
                            ( !option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

                        // Get the specific value for the option
                        value = jQuery( option ).val();

                        // We don't need an array for one selects
                        if ( one ) {
                            return value;
                        }

                        // Multi-Selects return an array
                        values.push( value );
                    }
                }

                return values;
            },

            set: function( elem, value ) {
                var values = jQuery.makeArray( value );

                jQuery(elem).find("option").each(function() {
                    this.selected = jQuery.inArray( jQuery(this).val(), values ) >= 0;
                });

                if ( !values.length ) {
                    elem.selectedIndex = -1;
                }
                return values;
            }
        }
    },

    // Unused in 1.8, left in so attrFn-stabbers won't die; remove in 1.9
    attrFn: {},

    attr: function( elem, name, value, pass ) {
        var ret, hooks, notxml,
            nType = elem.nodeType;

        // don't get/set attributes on text, comment and attribute nodes
        if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
            return;
        }

        if ( pass && jQuery.isFunction( jQuery.fn[ name ] ) ) {
            return jQuery( elem )[ name ]( value );
        }

        // Fallback to prop when attributes are not supported
        if ( typeof elem.getAttribute === "undefined" ) {
            return jQuery.prop( elem, name, value );
        }

        notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

        // All attributes are lowercase
        // Grab necessary hook if one is defined
        if ( notxml ) {
            name = name.toLowerCase();
            hooks = jQuery.attrHooks[ name ] || ( rboolean.test( name ) ? boolHook : nodeHook );
        }

        if ( value !== undefined ) {

            if ( value === null ) {
                jQuery.removeAttr( elem, name );
                return;

            } else if ( hooks && "set" in hooks && notxml && (ret = hooks.set( elem, value, name )) !== undefined ) {
                return ret;

            } else {
                elem.setAttribute( name, value + "" );
                return value;
            }

        } else if ( hooks && "get" in hooks && notxml && (ret = hooks.get( elem, name )) !== null ) {
            return ret;

        } else {

            ret = elem.getAttribute( name );

            // Non-existent attributes return null, we normalize to undefined
            return ret === null ?
                undefined :
                ret;
        }
    },

    removeAttr: function( elem, value ) {
        var propName, attrNames, name, isBool,
            i = 0;

        if ( value && elem.nodeType === 1 ) {

            attrNames = value.split( core_rspace );

            for ( ; i < attrNames.length; i++ ) {
                name = attrNames[ i ];

                if ( name ) {
                    propName = jQuery.propFix[ name ] || name;
                    isBool = rboolean.test( name );

                    // See #9699 for explanation of this approach (setting first, then removal)
                    // Do not do this for boolean attributes (see #10870)
                    if ( !isBool ) {
                        jQuery.attr( elem, name, "" );
                    }
                    elem.removeAttribute( getSetAttribute ? name : propName );

                    // Set corresponding property to false for boolean attributes
                    if ( isBool && propName in elem ) {
                        elem[ propName ] = false;
                    }
                }
            }
        }
    },

    attrHooks: {
        type: {
            set: function( elem, value ) {
                // We can't allow the type property to be changed (since it causes problems in IE)
                if ( rtype.test( elem.nodeName ) && elem.parentNode ) {
                    jQuery.error( "type property can't be changed" );
                } else if ( !jQuery.support.radioValue && value === "radio" && jQuery.nodeName(elem, "input") ) {
                    // Setting the type on a radio button after the value resets the value in IE6-9
                    // Reset value to it's default in case type is set after value
                    // This is for element creation
                    var val = elem.value;
                    elem.setAttribute( "type", value );
                    if ( val ) {
                        elem.value = val;
                    }
                    return value;
                }
            }
        },
        // Use the value property for back compat
        // Use the nodeHook for button elements in IE6/7 (#1954)
        value: {
            get: function( elem, name ) {
                if ( nodeHook && jQuery.nodeName( elem, "button" ) ) {
                    return nodeHook.get( elem, name );
                }
                return name in elem ?
                    elem.value :
                    null;
            },
            set: function( elem, value, name ) {
                if ( nodeHook && jQuery.nodeName( elem, "button" ) ) {
                    return nodeHook.set( elem, value, name );
                }
                // Does not return so that setAttribute is also used
                elem.value = value;
            }
        }
    },

    propFix: {
        tabindex: "tabIndex",
        readonly: "readOnly",
        "for": "htmlFor",
        "class": "className",
        maxlength: "maxLength",
        cellspacing: "cellSpacing",
        cellpadding: "cellPadding",
        rowspan: "rowSpan",
        colspan: "colSpan",
        usemap: "useMap",
        frameborder: "frameBorder",
        contenteditable: "contentEditable"
    },

    prop: function( elem, name, value ) {
        var ret, hooks, notxml,
            nType = elem.nodeType;

        // don't get/set properties on text, comment and attribute nodes
        if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
            return;
        }

        notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

        if ( notxml ) {
            // Fix name and attach hooks
            name = jQuery.propFix[ name ] || name;
            hooks = jQuery.propHooks[ name ];
        }

        if ( value !== undefined ) {
            if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
                return ret;

            } else {
                return ( elem[ name ] = value );
            }

        } else {
            if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ) {
                return ret;

            } else {
                return elem[ name ];
            }
        }
    },

    propHooks: {
        tabIndex: {
            get: function( elem ) {
                // elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
                // http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
                var attributeNode = elem.getAttributeNode("tabindex");

                return attributeNode && attributeNode.specified ?
                    parseInt( attributeNode.value, 10 ) :
                    rfocusable.test( elem.nodeName ) || rclickable.test( elem.nodeName ) && elem.href ?
                        0 :
                        undefined;
            }
        }
    }
});

// Hook for boolean attributes
boolHook = {
    get: function( elem, name ) {
        // Align boolean attributes with corresponding properties
        // Fall back to attribute presence where some booleans are not supported
        var attrNode,
            property = jQuery.prop( elem, name );
        return property === true || typeof property !== "boolean" && ( attrNode = elem.getAttributeNode(name) ) && attrNode.nodeValue !== false ?
            name.toLowerCase() :
            undefined;
    },
    set: function( elem, value, name ) {
        var propName;
        if ( value === false ) {
            // Remove boolean attributes when set to false
            jQuery.removeAttr( elem, name );
        } else {
            // value is true since we know at this point it's type boolean and not false
            // Set boolean attributes to the same name and set the DOM property
            propName = jQuery.propFix[ name ] || name;
            if ( propName in elem ) {
                // Only set the IDL specifically if it already exists on the element
                elem[ propName ] = true;
            }

            elem.setAttribute( name, name.toLowerCase() );
        }
        return name;
    }
};

// IE6/7 do not support getting/setting some attributes with get/setAttribute
if ( !getSetAttribute ) {

    fixSpecified = {
        name: true,
        id: true,
        coords: true
    };

    // Use this for any attribute in IE6/7
    // This fixes almost every IE6/7 issue
    nodeHook = jQuery.valHooks.button = {
        get: function( elem, name ) {
            var ret;
            ret = elem.getAttributeNode( name );
            return ret && ( fixSpecified[ name ] ? ret.value !== "" : ret.specified ) ?
                ret.value :
                undefined;
        },
        set: function( elem, value, name ) {
            // Set the existing or create a new attribute node
            var ret = elem.getAttributeNode( name );
            if ( !ret ) {
                ret = document.createAttribute( name );
                elem.setAttributeNode( ret );
            }
            return ( ret.value = value + "" );
        }
    };

    // Set width and height to auto instead of 0 on empty string( Bug #8150 )
    // This is for removals
    jQuery.each([ "width", "height" ], function( i, name ) {
        jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
            set: function( elem, value ) {
                if ( value === "" ) {
                    elem.setAttribute( name, "auto" );
                    return value;
                }
            }
        });
    });

    // Set contenteditable to false on removals(#10429)
    // Setting to empty string throws an error as an invalid value
    jQuery.attrHooks.contenteditable = {
        get: nodeHook.get,
        set: function( elem, value, name ) {
            if ( value === "" ) {
                value = "false";
            }
            nodeHook.set( elem, value, name );
        }
    };
}


// Some attributes require a special call on IE
if ( !jQuery.support.hrefNormalized ) {
    jQuery.each([ "href", "src", "width", "height" ], function( i, name ) {
        jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
            get: function( elem ) {
                var ret = elem.getAttribute( name, 2 );
                return ret === null ? undefined : ret;
            }
        });
    });
}

if ( !jQuery.support.style ) {
    jQuery.attrHooks.style = {
        get: function( elem ) {
            // Return undefined in the case of empty string
            // Normalize to lowercase since IE uppercases css property names
            return elem.style.cssText.toLowerCase() || undefined;
        },
        set: function( elem, value ) {
            return ( elem.style.cssText = value + "" );
        }
    };
}

// Safari mis-reports the default selected property of an option
// Accessing the parent's selectedIndex property fixes it
if ( !jQuery.support.optSelected ) {
    jQuery.propHooks.selected = jQuery.extend( jQuery.propHooks.selected, {
        get: function( elem ) {
            var parent = elem.parentNode;

            if ( parent ) {
                parent.selectedIndex;

                // Make sure that it also works with optgroups, see #5701
                if ( parent.parentNode ) {
                    parent.parentNode.selectedIndex;
                }
            }
            return null;
        }
    });
}

// IE6/7 call enctype encoding
if ( !jQuery.support.enctype ) {
    jQuery.propFix.enctype = "encoding";
}

// Radios and checkboxes getter/setter
if ( !jQuery.support.checkOn ) {
    jQuery.each([ "radio", "checkbox" ], function() {
        jQuery.valHooks[ this ] = {
            get: function( elem ) {
                // Handle the case where in Webkit "" is returned instead of "on" if a value isn't specified
                return elem.getAttribute("value") === null ? "on" : elem.value;
            }
        };
    });
}
jQuery.each([ "radio", "checkbox" ], function() {
    jQuery.valHooks[ this ] = jQuery.extend( jQuery.valHooks[ this ], {
        set: function( elem, value ) {
            if ( jQuery.isArray( value ) ) {
                return ( elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0 );
            }
        }
    });
});
var rformElems = /^(?:textarea|input|select)$/i,
    rtypenamespace = /^([^\.]*|)(?:\.(.+)|)$/,
    rhoverHack = /(?:^|\s)hover(\.\S+|)\b/,
    rkeyEvent = /^key/,
    rmouseEvent = /^(?:mouse|contextmenu)|click/,
    rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
    hoverHack = function( events ) {
        return jQuery.event.special.hover ? events : events.replace( rhoverHack, "mouseenter$1 mouseleave$1" );
    };

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

    add: function( elem, types, handler, data, selector ) {

        var elemData, eventHandle, events,
            t, tns, type, namespaces, handleObj,
            handleObjIn, handlers, special;

        // Don't attach events to noData or text/comment nodes (allow plain objects tho)
        if ( elem.nodeType === 3 || elem.nodeType === 8 || !types || !handler || !(elemData = jQuery._data( elem )) ) {
            return;
        }

        // Caller can pass in an object of custom data in lieu of the handler
        if ( handler.handler ) {
            handleObjIn = handler;
            handler = handleObjIn.handler;
            selector = handleObjIn.selector;
        }

        // Make sure that the handler has a unique ID, used to find/remove it later
        if ( !handler.guid ) {
            handler.guid = jQuery.guid++;
        }

        // Init the element's event structure and main handler, if this is the first
        events = elemData.events;
        if ( !events ) {
            elemData.events = events = {};
        }
        eventHandle = elemData.handle;
        if ( !eventHandle ) {
            elemData.handle = eventHandle = function( e ) {
                // Discard the second event of a jQuery.event.trigger() and
                // when an event is called after a page has unloaded
                return typeof jQuery !== "undefined" && (!e || jQuery.event.triggered !== e.type) ?
                    jQuery.event.dispatch.apply( eventHandle.elem, arguments ) :
                    undefined;
            };
            // Add elem as a property of the handle fn to prevent a memory leak with IE non-native events
            eventHandle.elem = elem;
        }

        // Handle multiple events separated by a space
        // jQuery(...).bind("mouseover mouseout", fn);
        types = jQuery.trim( hoverHack(types) ).split( " " );
        for ( t = 0; t < types.length; t++ ) {

            tns = rtypenamespace.exec( types[t] ) || [];
            type = tns[1];
            namespaces = ( tns[2] || "" ).split( "." ).sort();

            // If event changes its type, use the special event handlers for the changed type
            special = jQuery.event.special[ type ] || {};

            // If selector defined, determine special event api type, otherwise given type
            type = ( selector ? special.delegateType : special.bindType ) || type;

            // Update special based on newly reset type
            special = jQuery.event.special[ type ] || {};

            // handleObj is passed to all event handlers
            handleObj = jQuery.extend({
                type: type,
                origType: tns[1],
                data: data,
                handler: handler,
                guid: handler.guid,
                selector: selector,
                needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
                namespace: namespaces.join(".")
            }, handleObjIn );

            // Init the event handler queue if we're the first
            handlers = events[ type ];
            if ( !handlers ) {
                handlers = events[ type ] = [];
                handlers.delegateCount = 0;

                // Only use addEventListener/attachEvent if the special events handler returns false
                if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
                    // Bind the global event handler to the element
                    if ( elem.addEventListener ) {
                        elem.addEventListener( type, eventHandle, false );

                    } else if ( elem.attachEvent ) {
                        elem.attachEvent( "on" + type, eventHandle );
                    }
                }
            }

            if ( special.add ) {
                special.add.call( elem, handleObj );

                if ( !handleObj.handler.guid ) {
                    handleObj.handler.guid = handler.guid;
                }
            }

            // Add to the element's handler list, delegates in front
            if ( selector ) {
                handlers.splice( handlers.delegateCount++, 0, handleObj );
            } else {
                handlers.push( handleObj );
            }

            // Keep track of which events have ever been used, for event optimization
            jQuery.event.global[ type ] = true;
        }

        // Nullify elem to prevent memory leaks in IE
        elem = null;
    },

    global: {},

    // Detach an event or set of events from an element
    remove: function( elem, types, handler, selector, mappedTypes ) {

        var t, tns, type, origType, namespaces, origCount,
            j, events, special, eventType, handleObj,
            elemData = jQuery.hasData( elem ) && jQuery._data( elem );

        if ( !elemData || !(events = elemData.events) ) {
            return;
        }

        // Once for each type.namespace in types; type may be omitted
        types = jQuery.trim( hoverHack( types || "" ) ).split(" ");
        for ( t = 0; t < types.length; t++ ) {
            tns = rtypenamespace.exec( types[t] ) || [];
            type = origType = tns[1];
            namespaces = tns[2];

            // Unbind all events (on this namespace, if provided) for the element
            if ( !type ) {
                for ( type in events ) {
                    jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
                }
                continue;
            }

            special = jQuery.event.special[ type ] || {};
            type = ( selector? special.delegateType : special.bindType ) || type;
            eventType = events[ type ] || [];
            origCount = eventType.length;
            namespaces = namespaces ? new RegExp("(^|\\.)" + namespaces.split(".").sort().join("\\.(?:.*\\.|)") + "(\\.|$)") : null;

            // Remove matching events
            for ( j = 0; j < eventType.length; j++ ) {
                handleObj = eventType[ j ];

                if ( ( mappedTypes || origType === handleObj.origType ) &&
                     ( !handler || handler.guid === handleObj.guid ) &&
                     ( !namespaces || namespaces.test( handleObj.namespace ) ) &&
                     ( !selector || selector === handleObj.selector || selector === "**" && handleObj.selector ) ) {
                    eventType.splice( j--, 1 );

                    if ( handleObj.selector ) {
                        eventType.delegateCount--;
                    }
                    if ( special.remove ) {
                        special.remove.call( elem, handleObj );
                    }
                }
            }

            // Remove generic event handler if we removed something and no more handlers exist
            // (avoids potential for endless recursion during removal of special event handlers)
            if ( eventType.length === 0 && origCount !== eventType.length ) {
                if ( !special.teardown || special.teardown.call( elem, namespaces, elemData.handle ) === false ) {
                    jQuery.removeEvent( elem, type, elemData.handle );
                }

                delete events[ type ];
            }
        }

        // Remove the expando if it's no longer used
        if ( jQuery.isEmptyObject( events ) ) {
            delete elemData.handle;

            // removeData also checks for emptiness and clears the expando if empty
            // so use it instead of delete
            jQuery.removeData( elem, "events", true );
        }
    },

    // Events that are safe to short-circuit if no handlers are attached.
    // Native DOM events should not be added, they may have inline handlers.
    customEvent: {
        "getData": true,
        "setData": true,
        "changeData": true
    },

    trigger: function( event, data, elem, onlyHandlers ) {
        // Don't do events on text and comment nodes
        if ( elem && (elem.nodeType === 3 || elem.nodeType === 8) ) {
            return;
        }

        // Event object or event type
        var cache, exclusive, i, cur, old, ontype, special, handle, eventPath, bubbleType,
            type = event.type || event,
            namespaces = [];

        // focus/blur morphs to focusin/out; ensure we're not firing them right now
        if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
            return;
        }

        if ( type.indexOf( "!" ) >= 0 ) {
            // Exclusive events trigger only for the exact event (no namespaces)
            type = type.slice(0, -1);
            exclusive = true;
        }

        if ( type.indexOf( "." ) >= 0 ) {
            // Namespaced trigger; create a regexp to match event type in handle()
            namespaces = type.split(".");
            type = namespaces.shift();
            namespaces.sort();
        }

        if ( (!elem || jQuery.event.customEvent[ type ]) && !jQuery.event.global[ type ] ) {
            // No jQuery handlers for this event type, and it can't have inline handlers
            return;
        }

        // Caller can pass in an Event, Object, or just an event type string
        event = typeof event === "object" ?
            // jQuery.Event object
            event[ jQuery.expando ] ? event :
            // Object literal
            new jQuery.Event( type, event ) :
            // Just the event type (string)
            new jQuery.Event( type );

        event.type = type;
        event.isTrigger = true;
        event.exclusive = exclusive;
        event.namespace = namespaces.join( "." );
        event.namespace_re = event.namespace? new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)") : null;
        ontype = type.indexOf( ":" ) < 0 ? "on" + type : "";

        // Handle a global trigger
        if ( !elem ) {

            // TODO: Stop taunting the data cache; remove global events and always attach to document
            cache = jQuery.cache;
            for ( i in cache ) {
                if ( cache[ i ].events && cache[ i ].events[ type ] ) {
                    jQuery.event.trigger( event, data, cache[ i ].handle.elem, true );
                }
            }
            return;
        }

        // Clean up the event in case it is being reused
        event.result = undefined;
        if ( !event.target ) {
            event.target = elem;
        }

        // Clone any incoming data and prepend the event, creating the handler arg list
        data = data != null ? jQuery.makeArray( data ) : [];
        data.unshift( event );

        // Allow special events to draw outside the lines
        special = jQuery.event.special[ type ] || {};
        if ( special.trigger && special.trigger.apply( elem, data ) === false ) {
            return;
        }

        // Determine event propagation path in advance, per W3C events spec (#9951)
        // Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
        eventPath = [[ elem, special.bindType || type ]];
        if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

            bubbleType = special.delegateType || type;
            cur = rfocusMorph.test( bubbleType + type ) ? elem : elem.parentNode;
            for ( old = elem; cur; cur = cur.parentNode ) {
                eventPath.push([ cur, bubbleType ]);
                old = cur;
            }

            // Only add window if we got to document (e.g., not plain obj or detached DOM)
            if ( old === (elem.ownerDocument || document) ) {
                eventPath.push([ old.defaultView || old.parentWindow || window, bubbleType ]);
            }
        }

        // Fire handlers on the event path
        for ( i = 0; i < eventPath.length && !event.isPropagationStopped(); i++ ) {

            cur = eventPath[i][0];
            event.type = eventPath[i][1];

            handle = ( jQuery._data( cur, "events" ) || {} )[ event.type ] && jQuery._data( cur, "handle" );
            if ( handle ) {
                handle.apply( cur, data );
            }
            // Note that this is a bare JS function and not a jQuery handler
            handle = ontype && cur[ ontype ];
            if ( handle && jQuery.acceptData( cur ) && handle.apply && handle.apply( cur, data ) === false ) {
                event.preventDefault();
            }
        }
        event.type = type;

        // If nobody prevented the default action, do it now
        if ( !onlyHandlers && !event.isDefaultPrevented() ) {

            if ( (!special._default || special._default.apply( elem.ownerDocument, data ) === false) &&
                !(type === "click" && jQuery.nodeName( elem, "a" )) && jQuery.acceptData( elem ) ) {

                // Call a native DOM method on the target with the same name name as the event.
                // Can't use an .isFunction() check here because IE6/7 fails that test.
                // Don't do default actions on window, that's where global variables be (#6170)
                // IE<9 dies on focus/blur to hidden element (#1486)
                if ( ontype && elem[ type ] && ((type !== "focus" && type !== "blur") || event.target.offsetWidth !== 0) && !jQuery.isWindow( elem ) ) {

                    // Don't re-trigger an onFOO event when we call its FOO() method
                    old = elem[ ontype ];

                    if ( old ) {
                        elem[ ontype ] = null;
                    }

                    // Prevent re-triggering of the same event, since we already bubbled it above
                    jQuery.event.triggered = type;
                    elem[ type ]();
                    jQuery.event.triggered = undefined;

                    if ( old ) {
                        elem[ ontype ] = old;
                    }
                }
            }
        }

        return event.result;
    },

    dispatch: function( event ) {

        // Make a writable jQuery.Event from the native event object
        event = jQuery.event.fix( event || window.event );

        var i, j, cur, ret, selMatch, matched, matches, handleObj, sel, related,
            handlers = ( (jQuery._data( this, "events" ) || {} )[ event.type ] || []),
            delegateCount = handlers.delegateCount,
            args = core_slice.call( arguments ),
            run_all = !event.exclusive && !event.namespace,
            special = jQuery.event.special[ event.type ] || {},
            handlerQueue = [];

        // Use the fix-ed jQuery.Event rather than the (read-only) native event
        args[0] = event;
        event.delegateTarget = this;

        // Call the preDispatch hook for the mapped type, and let it bail if desired
        if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
            return;
        }

        // Determine handlers that should run if there are delegated events
        // Avoid non-left-click bubbling in Firefox (#3861)
        if ( delegateCount && !(event.button && event.type === "click") ) {

            for ( cur = event.target; cur != this; cur = cur.parentNode || this ) {

                // Don't process clicks (ONLY) on disabled elements (#6911, #8165, #11382, #11764)
                if ( cur.disabled !== true || event.type !== "click" ) {
                    selMatch = {};
                    matches = [];
                    for ( i = 0; i < delegateCount; i++ ) {
                        handleObj = handlers[ i ];
                        sel = handleObj.selector;

                        if ( selMatch[ sel ] === undefined ) {
                            selMatch[ sel ] = handleObj.needsContext ?
                                jQuery( sel, this ).index( cur ) >= 0 :
                                jQuery.find( sel, this, null, [ cur ] ).length;
                        }
                        if ( selMatch[ sel ] ) {
                            matches.push( handleObj );
                        }
                    }
                    if ( matches.length ) {
                        handlerQueue.push({ elem: cur, matches: matches });
                    }
                }
            }
        }

        // Add the remaining (directly-bound) handlers
        if ( handlers.length > delegateCount ) {
            handlerQueue.push({ elem: this, matches: handlers.slice( delegateCount ) });
        }

        // Run delegates first; they may want to stop propagation beneath us
        for ( i = 0; i < handlerQueue.length && !event.isPropagationStopped(); i++ ) {
            matched = handlerQueue[ i ];
            event.currentTarget = matched.elem;

            for ( j = 0; j < matched.matches.length && !event.isImmediatePropagationStopped(); j++ ) {
                handleObj = matched.matches[ j ];

                // Triggered event must either 1) be non-exclusive and have no namespace, or
                // 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
                if ( run_all || (!event.namespace && !handleObj.namespace) || event.namespace_re && event.namespace_re.test( handleObj.namespace ) ) {

                    event.data = handleObj.data;
                    event.handleObj = handleObj;

                    ret = ( (jQuery.event.special[ handleObj.origType ] || {}).handle || handleObj.handler )
                            .apply( matched.elem, args );

                    if ( ret !== undefined ) {
                        event.result = ret;
                        if ( ret === false ) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
                }
            }
        }

        // Call the postDispatch hook for the mapped type
        if ( special.postDispatch ) {
            special.postDispatch.call( this, event );
        }

        return event.result;
    },

    // Includes some event props shared by KeyEvent and MouseEvent
    // *** attrChange attrName relatedNode srcElement  are not normalized, non-W3C, deprecated, will be removed in 1.8 ***
    props: "attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

    fixHooks: {},

    keyHooks: {
        props: "char charCode key keyCode".split(" "),
        filter: function( event, original ) {

            // Add which for key events
            if ( event.which == null ) {
                event.which = original.charCode != null ? original.charCode : original.keyCode;
            }

            return event;
        }
    },

    mouseHooks: {
        props: "button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
        filter: function( event, original ) {
            var eventDoc, doc, body,
                button = original.button,
                fromElement = original.fromElement;

            // Calculate pageX/Y if missing and clientX/Y available
            if ( event.pageX == null && original.clientX != null ) {
                eventDoc = event.target.ownerDocument || document;
                doc = eventDoc.documentElement;
                body = eventDoc.body;

                event.pageX = original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
                event.pageY = original.clientY + ( doc && doc.scrollTop  || body && body.scrollTop  || 0 ) - ( doc && doc.clientTop  || body && body.clientTop  || 0 );
            }

            // Add relatedTarget, if necessary
            if ( !event.relatedTarget && fromElement ) {
                event.relatedTarget = fromElement === event.target ? original.toElement : fromElement;
            }

            // Add which for click: 1 === left; 2 === middle; 3 === right
            // Note: button is not normalized, so don't use it
            if ( !event.which && button !== undefined ) {
                event.which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
            }

            return event;
        }
    },

    fix: function( event ) {
        if ( event[ jQuery.expando ] ) {
            return event;
        }

        // Create a writable copy of the event object and normalize some properties
        var i, prop,
            originalEvent = event,
            fixHook = jQuery.event.fixHooks[ event.type ] || {},
            copy = fixHook.props ? this.props.concat( fixHook.props ) : this.props;

        event = jQuery.Event( originalEvent );

        for ( i = copy.length; i; ) {
            prop = copy[ --i ];
            event[ prop ] = originalEvent[ prop ];
        }

        // Fix target property, if necessary (#1925, IE 6/7/8 & Safari2)
        if ( !event.target ) {
            event.target = originalEvent.srcElement || document;
        }

        // Target should not be a text node (#504, Safari)
        if ( event.target.nodeType === 3 ) {
            event.target = event.target.parentNode;
        }

        // For mouse/key events, metaKey==false if it's undefined (#3368, #11328; IE6/7/8)
        event.metaKey = !!event.metaKey;

        return fixHook.filter? fixHook.filter( event, originalEvent ) : event;
    },

    special: {
        load: {
            // Prevent triggered image.load events from bubbling to window.load
            noBubble: true
        },

        focus: {
            delegateType: "focusin"
        },
        blur: {
            delegateType: "focusout"
        },

        beforeunload: {
            setup: function( data, namespaces, eventHandle ) {
                // We only want to do this special case on windows
                if ( jQuery.isWindow( this ) ) {
                    this.onbeforeunload = eventHandle;
                }
            },

            teardown: function( namespaces, eventHandle ) {
                if ( this.onbeforeunload === eventHandle ) {
                    this.onbeforeunload = null;
                }
            }
        }
    },

    simulate: function( type, elem, event, bubble ) {
        // Piggyback on a donor event to simulate a different one.
        // Fake originalEvent to avoid donor's stopPropagation, but if the
        // simulated event prevents default then we do the same on the donor.
        var e = jQuery.extend(
            new jQuery.Event(),
            event,
            { type: type,
                isSimulated: true,
                originalEvent: {}
            }
        );
        if ( bubble ) {
            jQuery.event.trigger( e, null, elem );
        } else {
            jQuery.event.dispatch.call( elem, e );
        }
        if ( e.isDefaultPrevented() ) {
            event.preventDefault();
        }
    }
};

// Some plugins are using, but it's undocumented/deprecated and will be removed.
// The 1.7 special event interface should provide all the hooks needed now.
jQuery.event.handle = jQuery.event.dispatch;

jQuery.removeEvent = document.removeEventListener ?
    function( elem, type, handle ) {
        if ( elem.removeEventListener ) {
            elem.removeEventListener( type, handle, false );
        }
    } :
    function( elem, type, handle ) {
        var name = "on" + type;

        if ( elem.detachEvent ) {

            // #8545, #7054, preventing memory leaks for custom events in IE6-8
            // detachEvent needed property on element, by name of that event, to properly expose it to GC
            if ( typeof elem[ name ] === "undefined" ) {
                elem[ name ] = null;
            }

            elem.detachEvent( name, handle );
        }
    };

jQuery.Event = function( src, props ) {
    // Allow instantiation without the 'new' keyword
    if ( !(this instanceof jQuery.Event) ) {
        return new jQuery.Event( src, props );
    }

    // Event object
    if ( src && src.type ) {
        this.originalEvent = src;
        this.type = src.type;

        // Events bubbling up the document may have been marked as prevented
        // by a handler lower down the tree; reflect the correct value.
        this.isDefaultPrevented = ( src.defaultPrevented || src.returnValue === false ||
            src.getPreventDefault && src.getPreventDefault() ) ? returnTrue : returnFalse;

    // Event type
    } else {
        this.type = src;
    }

    // Put explicitly provided properties onto the event object
    if ( props ) {
        jQuery.extend( this, props );
    }

    // Create a timestamp if incoming event doesn't have one
    this.timeStamp = src && src.timeStamp || jQuery.now();

    // Mark it as fixed
    this[ jQuery.expando ] = true;
};

function returnFalse() {
    return false;
}
function returnTrue() {
    return true;
}

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
    preventDefault: function() {
        this.isDefaultPrevented = returnTrue;

        var e = this.originalEvent;
        if ( !e ) {
            return;
        }

        // if preventDefault exists run it on the original event
        if ( e.preventDefault ) {
            e.preventDefault();

        // otherwise set the returnValue property of the original event to false (IE)
        } else {
            e.returnValue = false;
        }
    },
    stopPropagation: function() {
        this.isPropagationStopped = returnTrue;

        var e = this.originalEvent;
        if ( !e ) {
            return;
        }
        // if stopPropagation exists run it on the original event
        if ( e.stopPropagation ) {
            e.stopPropagation();
        }
        // otherwise set the cancelBubble property of the original event to true (IE)
        e.cancelBubble = true;
    },
    stopImmediatePropagation: function() {
        this.isImmediatePropagationStopped = returnTrue;
        this.stopPropagation();
    },
    isDefaultPrevented: returnFalse,
    isPropagationStopped: returnFalse,
    isImmediatePropagationStopped: returnFalse
};

// Create mouseenter/leave events using mouseover/out and event-time checks
jQuery.each({
    mouseenter: "mouseover",
    mouseleave: "mouseout"
}, function( orig, fix ) {
    jQuery.event.special[ orig ] = {
        delegateType: fix,
        bindType: fix,

        handle: function( event ) {
            var ret,
                target = this,
                related = event.relatedTarget,
                handleObj = event.handleObj,
                selector = handleObj.selector;

            // For mousenter/leave call the handler if related is outside the target.
            // NB: No relatedTarget if the mouse left/entered the browser window
            if ( !related || (related !== target && !jQuery.contains( target, related )) ) {
                event.type = handleObj.origType;
                ret = handleObj.handler.apply( this, arguments );
                event.type = fix;
            }
            return ret;
        }
    };
});

// IE submit delegation
if ( !jQuery.support.submitBubbles ) {

    jQuery.event.special.submit = {
        setup: function() {
            // Only need this for delegated form submit events
            if ( jQuery.nodeName( this, "form" ) ) {
                return false;
            }

            // Lazy-add a submit handler when a descendant form may potentially be submitted
            jQuery.event.add( this, "click._submit keypress._submit", function( e ) {
                // Node name check avoids a VML-related crash in IE (#9807)
                var elem = e.target,
                    form = jQuery.nodeName( elem, "input" ) || jQuery.nodeName( elem, "button" ) ? elem.form : undefined;
                if ( form && !jQuery._data( form, "_submit_attached" ) ) {
                    jQuery.event.add( form, "submit._submit", function( event ) {
                        event._submit_bubble = true;
                    });
                    jQuery._data( form, "_submit_attached", true );
                }
            });
            // return undefined since we don't need an event listener
        },

        postDispatch: function( event ) {
            // If form was submitted by the user, bubble the event up the tree
            if ( event._submit_bubble ) {
                delete event._submit_bubble;
                if ( this.parentNode && !event.isTrigger ) {
                    jQuery.event.simulate( "submit", this.parentNode, event, true );
                }
            }
        },

        teardown: function() {
            // Only need this for delegated form submit events
            if ( jQuery.nodeName( this, "form" ) ) {
                return false;
            }

            // Remove delegated handlers; cleanData eventually reaps submit handlers attached above
            jQuery.event.remove( this, "._submit" );
        }
    };
}

// IE change delegation and checkbox/radio fix
if ( !jQuery.support.changeBubbles ) {

    jQuery.event.special.change = {

        setup: function() {

            if ( rformElems.test( this.nodeName ) ) {
                // IE doesn't fire change on a check/radio until blur; trigger it on click
                // after a propertychange. Eat the blur-change in special.change.handle.
                // This still fires onchange a second time for check/radio after blur.
                if ( this.type === "checkbox" || this.type === "radio" ) {
                    jQuery.event.add( this, "propertychange._change", function( event ) {
                        if ( event.originalEvent.propertyName === "checked" ) {
                            this._just_changed = true;
                        }
                    });
                    jQuery.event.add( this, "click._change", function( event ) {
                        if ( this._just_changed && !event.isTrigger ) {
                            this._just_changed = false;
                        }
                        // Allow triggered, simulated change events (#11500)
                        jQuery.event.simulate( "change", this, event, true );
                    });
                }
                return false;
            }
            // Delegated event; lazy-add a change handler on descendant inputs
            jQuery.event.add( this, "beforeactivate._change", function( e ) {
                var elem = e.target;

                if ( rformElems.test( elem.nodeName ) && !jQuery._data( elem, "_change_attached" ) ) {
                    jQuery.event.add( elem, "change._change", function( event ) {
                        if ( this.parentNode && !event.isSimulated && !event.isTrigger ) {
                            jQuery.event.simulate( "change", this.parentNode, event, true );
                        }
                    });
                    jQuery._data( elem, "_change_attached", true );
                }
            });
        },

        handle: function( event ) {
            var elem = event.target;

            // Swallow native change events from checkbox/radio, we already triggered them above
            if ( this !== elem || event.isSimulated || event.isTrigger || (elem.type !== "radio" && elem.type !== "checkbox") ) {
                return event.handleObj.handler.apply( this, arguments );
            }
        },

        teardown: function() {
            jQuery.event.remove( this, "._change" );

            return !rformElems.test( this.nodeName );
        }
    };
}

// Create "bubbling" focus and blur events
if ( !jQuery.support.focusinBubbles ) {
    jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

        // Attach a single capturing handler while someone wants focusin/focusout
        var attaches = 0,
            handler = function( event ) {
                jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ), true );
            };

        jQuery.event.special[ fix ] = {
            setup: function() {
                if ( attaches++ === 0 ) {
                    document.addEventListener( orig, handler, true );
                }
            },
            teardown: function() {
                if ( --attaches === 0 ) {
                    document.removeEventListener( orig, handler, true );
                }
            }
        };
    });
}

jQuery.fn.extend({

    on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
        var origFn, type;

        // Types can be a map of types/handlers
        if ( typeof types === "object" ) {
            // ( types-Object, selector, data )
            if ( typeof selector !== "string" ) { // && selector != null
                // ( types-Object, data )
                data = data || selector;
                selector = undefined;
            }
            for ( type in types ) {
                this.on( type, selector, data, types[ type ], one );
            }
            return this;
        }

        if ( data == null && fn == null ) {
            // ( types, fn )
            fn = selector;
            data = selector = undefined;
        } else if ( fn == null ) {
            if ( typeof selector === "string" ) {
                // ( types, selector, fn )
                fn = data;
                data = undefined;
            } else {
                // ( types, data, fn )
                fn = data;
                data = selector;
                selector = undefined;
            }
        }
        if ( fn === false ) {
            fn = returnFalse;
        } else if ( !fn ) {
            return this;
        }

        if ( one === 1 ) {
            origFn = fn;
            fn = function( event ) {
                // Can use an empty set, since event contains the info
                jQuery().off( event );
                return origFn.apply( this, arguments );
            };
            // Use same guid so caller can remove using origFn
            fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
        }
        return this.each( function() {
            jQuery.event.add( this, types, fn, data, selector );
        });
    },
    one: function( types, selector, data, fn ) {
        return this.on( types, selector, data, fn, 1 );
    },
    off: function( types, selector, fn ) {
        var handleObj, type;
        if ( types && types.preventDefault && types.handleObj ) {
            // ( event )  dispatched jQuery.Event
            handleObj = types.handleObj;
            jQuery( types.delegateTarget ).off(
                handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
                handleObj.selector,
                handleObj.handler
            );
            return this;
        }
        if ( typeof types === "object" ) {
            // ( types-object [, selector] )
            for ( type in types ) {
                this.off( type, selector, types[ type ] );
            }
            return this;
        }
        if ( selector === false || typeof selector === "function" ) {
            // ( types [, fn] )
            fn = selector;
            selector = undefined;
        }
        if ( fn === false ) {
            fn = returnFalse;
        }
        return this.each(function() {
            jQuery.event.remove( this, types, fn, selector );
        });
    },

    bind: function( types, data, fn ) {
        return this.on( types, null, data, fn );
    },
    unbind: function( types, fn ) {
        return this.off( types, null, fn );
    },

    live: function( types, data, fn ) {
        jQuery( this.context ).on( types, this.selector, data, fn );
        return this;
    },
    die: function( types, fn ) {
        jQuery( this.context ).off( types, this.selector || "**", fn );
        return this;
    },

    delegate: function( selector, types, data, fn ) {
        return this.on( types, selector, data, fn );
    },
    undelegate: function( selector, types, fn ) {
        // ( namespace ) or ( selector, types [, fn] )
        return arguments.length === 1 ? this.off( selector, "**" ) : this.off( types, selector || "**", fn );
    },

    trigger: function( type, data ) {
        return this.each(function() {
            jQuery.event.trigger( type, data, this );
        });
    },
    triggerHandler: function( type, data ) {
        if ( this[0] ) {
            return jQuery.event.trigger( type, data, this[0], true );
        }
    },

    toggle: function( fn ) {
        // Save reference to arguments for access in closure
        var args = arguments,
            guid = fn.guid || jQuery.guid++,
            i = 0,
            toggler = function( event ) {
                // Figure out which function to execute
                var lastToggle = ( jQuery._data( this, "lastToggle" + fn.guid ) || 0 ) % i;
                jQuery._data( this, "lastToggle" + fn.guid, lastToggle + 1 );

                // Make sure that clicks stop
                event.preventDefault();

                // and execute the function
                return args[ lastToggle ].apply( this, arguments ) || false;
            };

        // link all the functions, so any of them can unbind this click handler
        toggler.guid = guid;
        while ( i < args.length ) {
            args[ i++ ].guid = guid;
        }

        return this.click( toggler );
    },

    hover: function( fnOver, fnOut ) {
        return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
    }
});

jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
    "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
    "change select submit keydown keypress keyup error contextmenu").split(" "), function( i, name ) {

    // Handle event binding
    jQuery.fn[ name ] = function( data, fn ) {
        if ( fn == null ) {
            fn = data;
            data = null;
        }

        return arguments.length > 0 ?
            this.on( name, null, data, fn ) :
            this.trigger( name );
    };

    if ( rkeyEvent.test( name ) ) {
        jQuery.event.fixHooks[ name ] = jQuery.event.keyHooks;
    }

    if ( rmouseEvent.test( name ) ) {
        jQuery.event.fixHooks[ name ] = jQuery.event.mouseHooks;
    }
});
/*!
 * Sizzle CSS Selector Engine
 * Copyright 2012 jQuery Foundation and other contributors
 * Released under the MIT license
 * http://sizzlejs.com/
 */
(function( window, undefined ) {

var cachedruns,
    assertGetIdNotName,
    Expr,
    getText,
    isXML,
    contains,
    compile,
    sortOrder,
    hasDuplicate,
    outermostContext,

    baseHasDuplicate = true,
    strundefined = "undefined",

    expando = ( "sizcache" + Math.random() ).replace( ".", "" ),

    Token = String,
    document = window.document,
    docElem = document.documentElement,
    dirruns = 0,
    done = 0,
    pop = [].pop,
    push = [].push,
    slice = [].slice,
    // Use a stripped-down indexOf if a native one is unavailable
    indexOf = [].indexOf || function( elem ) {
        var i = 0,
            len = this.length;
        for ( ; i < len; i++ ) {
            if ( this[i] === elem ) {
                return i;
            }
        }
        return -1;
    },

    // Augment a function for special use by Sizzle
    markFunction = function( fn, value ) {
        fn[ expando ] = value == null || value;
        return fn;
    },

    createCache = function() {
        var cache = {},
            keys = [];

        return markFunction(function( key, value ) {
            // Only keep the most recent entries
            if ( keys.push( key ) > Expr.cacheLength ) {
                delete cache[ keys.shift() ];
            }

            // Retrieve with (key + " ") to avoid collision with native Object.prototype properties (see Issue #157)
            return (cache[ key + " " ] = value);
        }, cache );
    },

    classCache = createCache(),
    tokenCache = createCache(),
    compilerCache = createCache(),

    // Regex

    // Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
    whitespace = "[\\x20\\t\\r\\n\\f]",
    // http://www.w3.org/TR/css3-syntax/#characters
    characterEncoding = "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+",

    // Loosely modeled on CSS identifier characters
    // An unquoted value should be a CSS identifier (http://www.w3.org/TR/css3-selectors/#attribute-selectors)
    // Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
    identifier = characterEncoding.replace( "w", "w#" ),

    // Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
    operators = "([*^$|!~]?=)",
    attributes = "\\[" + whitespace + "*(" + characterEncoding + ")" + whitespace +
        "*(?:" + operators + whitespace + "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" + identifier + ")|)|)" + whitespace + "*\\]",

    // Prefer arguments not in parens/brackets,
    //   then attribute selectors and non-pseudos (denoted by :),
    //   then anything else
    // These preferences are here to reduce the number of selectors
    //   needing tokenize in the PSEUDO preFilter
    pseudos = ":(" + characterEncoding + ")(?:\\((?:(['\"])((?:\\\\.|[^\\\\])*?)\\2|([^()[\\]]*|(?:(?:" + attributes + ")|[^:]|\\\\.)*|.*))\\)|)",

    // For matchExpr.POS and matchExpr.needsContext
    pos = ":(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
        "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)",

    // Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
    rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

    rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
    rcombinators = new RegExp( "^" + whitespace + "*([\\x20\\t\\r\\n\\f>+~])" + whitespace + "*" ),
    rpseudo = new RegExp( pseudos ),

    // Easily-parseable/retrievable ID or TAG or CLASS selectors
    rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,

    rnot = /^:not/,
    rsibling = /[\x20\t\r\n\f]*[+~]/,
    rendsWithNot = /:not\($/,

    rheader = /h\d/i,
    rinputs = /input|select|textarea|button/i,

    rbackslash = /\\(?!\\)/g,

    matchExpr = {
        "ID": new RegExp( "^#(" + characterEncoding + ")" ),
        "CLASS": new RegExp( "^\\.(" + characterEncoding + ")" ),
        "NAME": new RegExp( "^\\[name=['\"]?(" + characterEncoding + ")['\"]?\\]" ),
        "TAG": new RegExp( "^(" + characterEncoding.replace( "w", "w*" ) + ")" ),
        "ATTR": new RegExp( "^" + attributes ),
        "PSEUDO": new RegExp( "^" + pseudos ),
        "POS": new RegExp( pos, "i" ),
        "CHILD": new RegExp( "^:(only|nth|first|last)-child(?:\\(" + whitespace +
            "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
            "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
        // For use in libraries implementing .is()
        "needsContext": new RegExp( "^" + whitespace + "*[>+~]|" + pos, "i" )
    },

    // Support

    // Used for testing something on an element
    assert = function( fn ) {
        var div = document.createElement("div");

        try {
            return fn( div );
        } catch (e) {
            return false;
        } finally {
            // release memory in IE
            div = null;
        }
    },

    // Check if getElementsByTagName("*") returns only elements
    assertTagNameNoComments = assert(function( div ) {
        div.appendChild( document.createComment("") );
        return !div.getElementsByTagName("*").length;
    }),

    // Check if getAttribute returns normalized href attributes
    assertHrefNotNormalized = assert(function( div ) {
        div.innerHTML = "<a href='#'></a>";
        return div.firstChild && typeof div.firstChild.getAttribute !== strundefined &&
            div.firstChild.getAttribute("href") === "#";
    }),

    // Check if attributes should be retrieved by attribute nodes
    assertAttributes = assert(function( div ) {
        div.innerHTML = "<select></select>";
        var type = typeof div.lastChild.getAttribute("multiple");
        // IE8 returns a string for some attributes even when not present
        return type !== "boolean" && type !== "string";
    }),

    // Check if getElementsByClassName can be trusted
    assertUsableClassName = assert(function( div ) {
        // Opera can't find a second classname (in 9.6)
        div.innerHTML = "<div class='hidden e'></div><div class='hidden'></div>";
        if ( !div.getElementsByClassName || !div.getElementsByClassName("e").length ) {
            return false;
        }

        // Safari 3.2 caches class attributes and doesn't catch changes
        div.lastChild.className = "e";
        return div.getElementsByClassName("e").length === 2;
    }),

    // Check if getElementById returns elements by name
    // Check if getElementsByName privileges form controls or returns elements by ID
    assertUsableName = assert(function( div ) {
        // Inject content
        div.id = expando + 0;
        div.innerHTML = "<a name='" + expando + "'></a><div name='" + expando + "'></div>";
        docElem.insertBefore( div, docElem.firstChild );

        // Test
        var pass = document.getElementsByName &&
            // buggy browsers will return fewer than the correct 2
            document.getElementsByName( expando ).length === 2 +
            // buggy browsers will return more than the correct 0
            document.getElementsByName( expando + 0 ).length;
        assertGetIdNotName = !document.getElementById( expando );

        // Cleanup
        docElem.removeChild( div );

        return pass;
    });

// If slice is not available, provide a backup
try {
    slice.call( docElem.childNodes, 0 )[0].nodeType;
} catch ( e ) {
    slice = function( i ) {
        var elem,
            results = [];
        for ( ; (elem = this[i]); i++ ) {
            results.push( elem );
        }
        return results;
    };
}

function Sizzle( selector, context, results, seed ) {
    results = results || [];
    context = context || document;
    var match, elem, xml, m,
        nodeType = context.nodeType;

    if ( !selector || typeof selector !== "string" ) {
        return results;
    }

    if ( nodeType !== 1 && nodeType !== 9 ) {
        return [];
    }

    xml = isXML( context );

    if ( !xml && !seed ) {
        if ( (match = rquickExpr.exec( selector )) ) {
            // Speed-up: Sizzle("#ID")
            if ( (m = match[1]) ) {
                if ( nodeType === 9 ) {
                    elem = context.getElementById( m );
                    // Check parentNode to catch when Blackberry 4.6 returns
                    // nodes that are no longer in the document #6963
                    if ( elem && elem.parentNode ) {
                        // Handle the case where IE, Opera, and Webkit return items
                        // by name instead of ID
                        if ( elem.id === m ) {
                            results.push( elem );
                            return results;
                        }
                    } else {
                        return results;
                    }
                } else {
                    // Context is not a document
                    if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
                        contains( context, elem ) && elem.id === m ) {
                        results.push( elem );
                        return results;
                    }
                }

            // Speed-up: Sizzle("TAG")
            } else if ( match[2] ) {
                push.apply( results, slice.call(context.getElementsByTagName( selector ), 0) );
                return results;

            // Speed-up: Sizzle(".CLASS")
            } else if ( (m = match[3]) && assertUsableClassName && context.getElementsByClassName ) {
                push.apply( results, slice.call(context.getElementsByClassName( m ), 0) );
                return results;
            }
        }
    }

    // All others
    return select( selector.replace( rtrim, "$1" ), context, results, seed, xml );
}

Sizzle.matches = function( expr, elements ) {
    return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
    return Sizzle( expr, null, null, [ elem ] ).length > 0;
};

// Returns a function to use in pseudos for input types
function createInputPseudo( type ) {
    return function( elem ) {
        var name = elem.nodeName.toLowerCase();
        return name === "input" && elem.type === type;
    };
}

// Returns a function to use in pseudos for buttons
function createButtonPseudo( type ) {
    return function( elem ) {
        var name = elem.nodeName.toLowerCase();
        return (name === "input" || name === "button") && elem.type === type;
    };
}

// Returns a function to use in pseudos for positionals
function createPositionalPseudo( fn ) {
    return markFunction(function( argument ) {
        argument = +argument;
        return markFunction(function( seed, matches ) {
            var j,
                matchIndexes = fn( [], seed.length, argument ),
                i = matchIndexes.length;

            // Match elements found at the specified indexes
            while ( i-- ) {
                if ( seed[ (j = matchIndexes[i]) ] ) {
                    seed[j] = !(matches[j] = seed[j]);
                }
            }
        });
    });
}

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
    var node,
        ret = "",
        i = 0,
        nodeType = elem.nodeType;

    if ( nodeType ) {
        if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
            // Use textContent for elements
            // innerText usage removed for consistency of new lines (see #11153)
            if ( typeof elem.textContent === "string" ) {
                return elem.textContent;
            } else {
                // Traverse its children
                for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
                    ret += getText( elem );
                }
            }
        } else if ( nodeType === 3 || nodeType === 4 ) {
            return elem.nodeValue;
        }
        // Do not include comment or processing instruction nodes
    } else {

        // If no nodeType, this is expected to be an array
        for ( ; (node = elem[i]); i++ ) {
            // Do not traverse comment nodes
            ret += getText( node );
        }
    }
    return ret;
};

isXML = Sizzle.isXML = function( elem ) {
    // documentElement is verified for cases where it doesn't yet exist
    // (such as loading iframes in IE - #4833)
    var documentElement = elem && (elem.ownerDocument || elem).documentElement;
    return documentElement ? documentElement.nodeName !== "HTML" : false;
};

// Element contains another
contains = Sizzle.contains = docElem.contains ?
    function( a, b ) {
        var adown = a.nodeType === 9 ? a.documentElement : a,
            bup = b && b.parentNode;
        return a === bup || !!( bup && bup.nodeType === 1 && adown.contains && adown.contains(bup) );
    } :
    docElem.compareDocumentPosition ?
    function( a, b ) {
        return b && !!( a.compareDocumentPosition( b ) & 16 );
    } :
    function( a, b ) {
        while ( (b = b.parentNode) ) {
            if ( b === a ) {
                return true;
            }
        }
        return false;
    };

Sizzle.attr = function( elem, name ) {
    var val,
        xml = isXML( elem );

    if ( !xml ) {
        name = name.toLowerCase();
    }
    if ( (val = Expr.attrHandle[ name ]) ) {
        return val( elem );
    }
    if ( xml || assertAttributes ) {
        return elem.getAttribute( name );
    }
    val = elem.getAttributeNode( name );
    return val ?
        typeof elem[ name ] === "boolean" ?
            elem[ name ] ? name : null :
            val.specified ? val.value : null :
        null;
};

Expr = Sizzle.selectors = {

    // Can be adjusted by the user
    cacheLength: 50,

    createPseudo: markFunction,

    match: matchExpr,

    // IE6/7 return a modified href
    attrHandle: assertHrefNotNormalized ?
        {} :
        {
            "href": function( elem ) {
                return elem.getAttribute( "href", 2 );
            },
            "type": function( elem ) {
                return elem.getAttribute("type");
            }
        },

    find: {
        "ID": assertGetIdNotName ?
            function( id, context, xml ) {
                if ( typeof context.getElementById !== strundefined && !xml ) {
                    var m = context.getElementById( id );
                    // Check parentNode to catch when Blackberry 4.6 returns
                    // nodes that are no longer in the document #6963
                    return m && m.parentNode ? [m] : [];
                }
            } :
            function( id, context, xml ) {
                if ( typeof context.getElementById !== strundefined && !xml ) {
                    var m = context.getElementById( id );

                    return m ?
                        m.id === id || typeof m.getAttributeNode !== strundefined && m.getAttributeNode("id").value === id ?
                            [m] :
                            undefined :
                        [];
                }
            },

        "TAG": assertTagNameNoComments ?
            function( tag, context ) {
                if ( typeof context.getElementsByTagName !== strundefined ) {
                    return context.getElementsByTagName( tag );
                }
            } :
            function( tag, context ) {
                var results = context.getElementsByTagName( tag );

                // Filter out possible comments
                if ( tag === "*" ) {
                    var elem,
                        tmp = [],
                        i = 0;

                    for ( ; (elem = results[i]); i++ ) {
                        if ( elem.nodeType === 1 ) {
                            tmp.push( elem );
                        }
                    }

                    return tmp;
                }
                return results;
            },

        "NAME": assertUsableName && function( tag, context ) {
            if ( typeof context.getElementsByName !== strundefined ) {
                return context.getElementsByName( name );
            }
        },

        "CLASS": assertUsableClassName && function( className, context, xml ) {
            if ( typeof context.getElementsByClassName !== strundefined && !xml ) {
                return context.getElementsByClassName( className );
            }
        }
    },

    relative: {
        ">": { dir: "parentNode", first: true },
        " ": { dir: "parentNode" },
        "+": { dir: "previousSibling", first: true },
        "~": { dir: "previousSibling" }
    },

    preFilter: {
        "ATTR": function( match ) {
            match[1] = match[1].replace( rbackslash, "" );

            // Move the given value to match[3] whether quoted or unquoted
            match[3] = ( match[4] || match[5] || "" ).replace( rbackslash, "" );

            if ( match[2] === "~=" ) {
                match[3] = " " + match[3] + " ";
            }

            return match.slice( 0, 4 );
        },

        "CHILD": function( match ) {
            /* matches from matchExpr["CHILD"]
                1 type (only|nth|...)
                2 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
                3 xn-component of xn+y argument ([+-]?\d*n|)
                4 sign of xn-component
                5 x of xn-component
                6 sign of y-component
                7 y of y-component
            */
            match[1] = match[1].toLowerCase();

            if ( match[1] === "nth" ) {
                // nth-child requires argument
                if ( !match[2] ) {
                    Sizzle.error( match[0] );
                }

                // numeric x and y parameters for Expr.filter.CHILD
                // remember that false/true cast respectively to 0/1
                match[3] = +( match[3] ? match[4] + (match[5] || 1) : 2 * ( match[2] === "even" || match[2] === "odd" ) );
                match[4] = +( ( match[6] + match[7] ) || match[2] === "odd" );

            // other types prohibit arguments
            } else if ( match[2] ) {
                Sizzle.error( match[0] );
            }

            return match;
        },

        "PSEUDO": function( match ) {
            var unquoted, excess;
            if ( matchExpr["CHILD"].test( match[0] ) ) {
                return null;
            }

            if ( match[3] ) {
                match[2] = match[3];
            } else if ( (unquoted = match[4]) ) {
                // Only check arguments that contain a pseudo
                if ( rpseudo.test(unquoted) &&
                    // Get excess from tokenize (recursively)
                    (excess = tokenize( unquoted, true )) &&
                    // advance to the next closing parenthesis
                    (excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

                    // excess is a negative index
                    unquoted = unquoted.slice( 0, excess );
                    match[0] = match[0].slice( 0, excess );
                }
                match[2] = unquoted;
            }

            // Return only captures needed by the pseudo filter method (type and argument)
            return match.slice( 0, 3 );
        }
    },

    filter: {
        "ID": assertGetIdNotName ?
            function( id ) {
                id = id.replace( rbackslash, "" );
                return function( elem ) {
                    return elem.getAttribute("id") === id;
                };
            } :
            function( id ) {
                id = id.replace( rbackslash, "" );
                return function( elem ) {
                    var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode("id");
                    return node && node.value === id;
                };
            },

        "TAG": function( nodeName ) {
            if ( nodeName === "*" ) {
                return function() { return true; };
            }
            nodeName = nodeName.replace( rbackslash, "" ).toLowerCase();

            return function( elem ) {
                return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
            };
        },

        "CLASS": function( className ) {
            var pattern = classCache[ expando ][ className + " " ];

            return pattern ||
                (pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
                classCache( className, function( elem ) {
                    return pattern.test( elem.className || (typeof elem.getAttribute !== strundefined && elem.getAttribute("class")) || "" );
                });
        },

        "ATTR": function( name, operator, check ) {
            return function( elem, context ) {
                var result = Sizzle.attr( elem, name );

                if ( result == null ) {
                    return operator === "!=";
                }
                if ( !operator ) {
                    return true;
                }

                result += "";

                return operator === "=" ? result === check :
                    operator === "!=" ? result !== check :
                    operator === "^=" ? check && result.indexOf( check ) === 0 :
                    operator === "*=" ? check && result.indexOf( check ) > -1 :
                    operator === "$=" ? check && result.substr( result.length - check.length ) === check :
                    operator === "~=" ? ( " " + result + " " ).indexOf( check ) > -1 :
                    operator === "|=" ? result === check || result.substr( 0, check.length + 1 ) === check + "-" :
                    false;
            };
        },

        "CHILD": function( type, argument, first, last ) {

            if ( type === "nth" ) {
                return function( elem ) {
                    var node, diff,
                        parent = elem.parentNode;

                    if ( first === 1 && last === 0 ) {
                        return true;
                    }

                    if ( parent ) {
                        diff = 0;
                        for ( node = parent.firstChild; node; node = node.nextSibling ) {
                            if ( node.nodeType === 1 ) {
                                diff++;
                                if ( elem === node ) {
                                    break;
                                }
                            }
                        }
                    }

                    // Incorporate the offset (or cast to NaN), then check against cycle size
                    diff -= last;
                    return diff === first || ( diff % first === 0 && diff / first >= 0 );
                };
            }

            return function( elem ) {
                var node = elem;

                switch ( type ) {
                    case "only":
                    case "first":
                        while ( (node = node.previousSibling) ) {
                            if ( node.nodeType === 1 ) {
                                return false;
                            }
                        }

                        if ( type === "first" ) {
                            return true;
                        }

                        node = elem;

                        /* falls through */
                    case "last":
                        while ( (node = node.nextSibling) ) {
                            if ( node.nodeType === 1 ) {
                                return false;
                            }
                        }

                        return true;
                }
            };
        },

        "PSEUDO": function( pseudo, argument ) {
            // pseudo-class names are case-insensitive
            // http://www.w3.org/TR/selectors/#pseudo-classes
            // Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
            // Remember that setFilters inherits from pseudos
            var args,
                fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
                    Sizzle.error( "unsupported pseudo: " + pseudo );

            // The user may use createPseudo to indicate that
            // arguments are needed to create the filter function
            // just as Sizzle does
            if ( fn[ expando ] ) {
                return fn( argument );
            }

            // But maintain support for old signatures
            if ( fn.length > 1 ) {
                args = [ pseudo, pseudo, "", argument ];
                return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
                    markFunction(function( seed, matches ) {
                        var idx,
                            matched = fn( seed, argument ),
                            i = matched.length;
                        while ( i-- ) {
                            idx = indexOf.call( seed, matched[i] );
                            seed[ idx ] = !( matches[ idx ] = matched[i] );
                        }
                    }) :
                    function( elem ) {
                        return fn( elem, 0, args );
                    };
            }

            return fn;
        }
    },

    pseudos: {
        "not": markFunction(function( selector ) {
            // Trim the selector passed to compile
            // to avoid treating leading and trailing
            // spaces as combinators
            var input = [],
                results = [],
                matcher = compile( selector.replace( rtrim, "$1" ) );

            return matcher[ expando ] ?
                markFunction(function( seed, matches, context, xml ) {
                    var elem,
                        unmatched = matcher( seed, null, xml, [] ),
                        i = seed.length;

                    // Match elements unmatched by `matcher`
                    while ( i-- ) {
                        if ( (elem = unmatched[i]) ) {
                            seed[i] = !(matches[i] = elem);
                        }
                    }
                }) :
                function( elem, context, xml ) {
                    input[0] = elem;
                    matcher( input, null, xml, results );
                    return !results.pop();
                };
        }),

        "has": markFunction(function( selector ) {
            return function( elem ) {
                return Sizzle( selector, elem ).length > 0;
            };
        }),

        "contains": markFunction(function( text ) {
            return function( elem ) {
                return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
            };
        }),

        "enabled": function( elem ) {
            return elem.disabled === false;
        },

        "disabled": function( elem ) {
            return elem.disabled === true;
        },

        "checked": function( elem ) {
            // In CSS3, :checked should return both checked and selected elements
            // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
            var nodeName = elem.nodeName.toLowerCase();
            return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
        },

        "selected": function( elem ) {
            // Accessing this property makes selected-by-default
            // options in Safari work properly
            if ( elem.parentNode ) {
                elem.parentNode.selectedIndex;
            }

            return elem.selected === true;
        },

        "parent": function( elem ) {
            return !Expr.pseudos["empty"]( elem );
        },

        "empty": function( elem ) {
            // http://www.w3.org/TR/selectors/#empty-pseudo
            // :empty is only affected by element nodes and content nodes(including text(3), cdata(4)),
            //   not comment, processing instructions, or others
            // Thanks to Diego Perini for the nodeName shortcut
            //   Greater than "@" means alpha characters (specifically not starting with "#" or "?")
            var nodeType;
            elem = elem.firstChild;
            while ( elem ) {
                if ( elem.nodeName > "@" || (nodeType = elem.nodeType) === 3 || nodeType === 4 ) {
                    return false;
                }
                elem = elem.nextSibling;
            }
            return true;
        },

        "header": function( elem ) {
            return rheader.test( elem.nodeName );
        },

        "text": function( elem ) {
            var type, attr;
            // IE6 and 7 will map elem.type to 'text' for new HTML5 types (search, etc)
            // use getAttribute instead to test this case
            return elem.nodeName.toLowerCase() === "input" &&
                (type = elem.type) === "text" &&
                ( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === type );
        },

        // Input types
        "radio": createInputPseudo("radio"),
        "checkbox": createInputPseudo("checkbox"),
        "file": createInputPseudo("file"),
        "password": createInputPseudo("password"),
        "image": createInputPseudo("image"),

        "submit": createButtonPseudo("submit"),
        "reset": createButtonPseudo("reset"),

        "button": function( elem ) {
            var name = elem.nodeName.toLowerCase();
            return name === "input" && elem.type === "button" || name === "button";
        },

        "input": function( elem ) {
            return rinputs.test( elem.nodeName );
        },

        "focus": function( elem ) {
            var doc = elem.ownerDocument;
            return elem === doc.activeElement && (!doc.hasFocus || doc.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
        },

        "active": function( elem ) {
            return elem === elem.ownerDocument.activeElement;
        },

        // Positional types
        "first": createPositionalPseudo(function() {
            return [ 0 ];
        }),

        "last": createPositionalPseudo(function( matchIndexes, length ) {
            return [ length - 1 ];
        }),

        "eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
            return [ argument < 0 ? argument + length : argument ];
        }),

        "even": createPositionalPseudo(function( matchIndexes, length ) {
            for ( var i = 0; i < length; i += 2 ) {
                matchIndexes.push( i );
            }
            return matchIndexes;
        }),

        "odd": createPositionalPseudo(function( matchIndexes, length ) {
            for ( var i = 1; i < length; i += 2 ) {
                matchIndexes.push( i );
            }
            return matchIndexes;
        }),

        "lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
            for ( var i = argument < 0 ? argument + length : argument; --i >= 0; ) {
                matchIndexes.push( i );
            }
            return matchIndexes;
        }),

        "gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
            for ( var i = argument < 0 ? argument + length : argument; ++i < length; ) {
                matchIndexes.push( i );
            }
            return matchIndexes;
        })
    }
};

function siblingCheck( a, b, ret ) {
    if ( a === b ) {
        return ret;
    }

    var cur = a.nextSibling;

    while ( cur ) {
        if ( cur === b ) {
            return -1;
        }

        cur = cur.nextSibling;
    }

    return 1;
}

sortOrder = docElem.compareDocumentPosition ?
    function( a, b ) {
        if ( a === b ) {
            hasDuplicate = true;
            return 0;
        }

        return ( !a.compareDocumentPosition || !b.compareDocumentPosition ?
            a.compareDocumentPosition :
            a.compareDocumentPosition(b) & 4
        ) ? -1 : 1;
    } :
    function( a, b ) {
        // The nodes are identical, we can exit early
        if ( a === b ) {
            hasDuplicate = true;
            return 0;

        // Fallback to using sourceIndex (in IE) if it's available on both nodes
        } else if ( a.sourceIndex && b.sourceIndex ) {
            return a.sourceIndex - b.sourceIndex;
        }

        var al, bl,
            ap = [],
            bp = [],
            aup = a.parentNode,
            bup = b.parentNode,
            cur = aup;

        // If the nodes are siblings (or identical) we can do a quick check
        if ( aup === bup ) {
            return siblingCheck( a, b );

        // If no parents were found then the nodes are disconnected
        } else if ( !aup ) {
            return -1;

        } else if ( !bup ) {
            return 1;
        }

        // Otherwise they're somewhere else in the tree so we need
        // to build up a full list of the parentNodes for comparison
        while ( cur ) {
            ap.unshift( cur );
            cur = cur.parentNode;
        }

        cur = bup;

        while ( cur ) {
            bp.unshift( cur );
            cur = cur.parentNode;
        }

        al = ap.length;
        bl = bp.length;

        // Start walking down the tree looking for a discrepancy
        for ( var i = 0; i < al && i < bl; i++ ) {
            if ( ap[i] !== bp[i] ) {
                return siblingCheck( ap[i], bp[i] );
            }
        }

        // We ended someplace up the tree so do a sibling check
        return i === al ?
            siblingCheck( a, bp[i], -1 ) :
            siblingCheck( ap[i], b, 1 );
    };

// Always assume the presence of duplicates if sort doesn't
// pass them to our comparison function (as in Google Chrome).
[0, 0].sort( sortOrder );
baseHasDuplicate = !hasDuplicate;

// Document sorting and removing duplicates
Sizzle.uniqueSort = function( results ) {
    var elem,
        duplicates = [],
        i = 1,
        j = 0;

    hasDuplicate = baseHasDuplicate;
    results.sort( sortOrder );

    if ( hasDuplicate ) {
        for ( ; (elem = results[i]); i++ ) {
            if ( elem === results[ i - 1 ] ) {
                j = duplicates.push( i );
            }
        }
        while ( j-- ) {
            results.splice( duplicates[ j ], 1 );
        }
    }

    return results;
};

Sizzle.error = function( msg ) {
    throw new Error( "Syntax error, unrecognized expression: " + msg );
};

function tokenize( selector, parseOnly ) {
    var matched, match, tokens, type,
        soFar, groups, preFilters,
        cached = tokenCache[ expando ][ selector + " " ];

    if ( cached ) {
        return parseOnly ? 0 : cached.slice( 0 );
    }

    soFar = selector;
    groups = [];
    preFilters = Expr.preFilter;

    while ( soFar ) {

        // Comma and first run
        if ( !matched || (match = rcomma.exec( soFar )) ) {
            if ( match ) {
                // Don't consume trailing commas as valid
                soFar = soFar.slice( match[0].length ) || soFar;
            }
            groups.push( tokens = [] );
        }

        matched = false;

        // Combinators
        if ( (match = rcombinators.exec( soFar )) ) {
            tokens.push( matched = new Token( match.shift() ) );
            soFar = soFar.slice( matched.length );

            // Cast descendant combinators to space
            matched.type = match[0].replace( rtrim, " " );
        }

        // Filters
        for ( type in Expr.filter ) {
            if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
                (match = preFilters[ type ]( match ))) ) {

                tokens.push( matched = new Token( match.shift() ) );
                soFar = soFar.slice( matched.length );
                matched.type = type;
                matched.matches = match;
            }
        }

        if ( !matched ) {
            break;
        }
    }

    // Return the length of the invalid excess
    // if we're just parsing
    // Otherwise, throw an error or return tokens
    return parseOnly ?
        soFar.length :
        soFar ?
            Sizzle.error( selector ) :
            // Cache the tokens
            tokenCache( selector, groups ).slice( 0 );
}

function addCombinator( matcher, combinator, base ) {
    var dir = combinator.dir,
        checkNonElements = base && combinator.dir === "parentNode",
        doneName = done++;

    return combinator.first ?
        // Check against closest ancestor/preceding element
        function( elem, context, xml ) {
            while ( (elem = elem[ dir ]) ) {
                if ( checkNonElements || elem.nodeType === 1  ) {
                    return matcher( elem, context, xml );
                }
            }
        } :

        // Check against all ancestor/preceding elements
        function( elem, context, xml ) {
            // We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
            if ( !xml ) {
                var cache,
                    dirkey = dirruns + " " + doneName + " ",
                    cachedkey = dirkey + cachedruns;
                while ( (elem = elem[ dir ]) ) {
                    if ( checkNonElements || elem.nodeType === 1 ) {
                        if ( (cache = elem[ expando ]) === cachedkey ) {
                            return elem.sizset;
                        } else if ( typeof cache === "string" && cache.indexOf(dirkey) === 0 ) {
                            if ( elem.sizset ) {
                                return elem;
                            }
                        } else {
                            elem[ expando ] = cachedkey;
                            if ( matcher( elem, context, xml ) ) {
                                elem.sizset = true;
                                return elem;
                            }
                            elem.sizset = false;
                        }
                    }
                }
            } else {
                while ( (elem = elem[ dir ]) ) {
                    if ( checkNonElements || elem.nodeType === 1 ) {
                        if ( matcher( elem, context, xml ) ) {
                            return elem;
                        }
                    }
                }
            }
        };
}

function elementMatcher( matchers ) {
    return matchers.length > 1 ?
        function( elem, context, xml ) {
            var i = matchers.length;
            while ( i-- ) {
                if ( !matchers[i]( elem, context, xml ) ) {
                    return false;
                }
            }
            return true;
        } :
        matchers[0];
}

function condense( unmatched, map, filter, context, xml ) {
    var elem,
        newUnmatched = [],
        i = 0,
        len = unmatched.length,
        mapped = map != null;

    for ( ; i < len; i++ ) {
        if ( (elem = unmatched[i]) ) {
            if ( !filter || filter( elem, context, xml ) ) {
                newUnmatched.push( elem );
                if ( mapped ) {
                    map.push( i );
                }
            }
        }
    }

    return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
    if ( postFilter && !postFilter[ expando ] ) {
        postFilter = setMatcher( postFilter );
    }
    if ( postFinder && !postFinder[ expando ] ) {
        postFinder = setMatcher( postFinder, postSelector );
    }
    return markFunction(function( seed, results, context, xml ) {
        var temp, i, elem,
            preMap = [],
            postMap = [],
            preexisting = results.length,

            // Get initial elements from seed or context
            elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

            // Prefilter to get matcher input, preserving a map for seed-results synchronization
            matcherIn = preFilter && ( seed || !selector ) ?
                condense( elems, preMap, preFilter, context, xml ) :
                elems,

            matcherOut = matcher ?
                // If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
                postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

                    // ...intermediate processing is necessary
                    [] :

                    // ...otherwise use results directly
                    results :
                matcherIn;

        // Find primary matches
        if ( matcher ) {
            matcher( matcherIn, matcherOut, context, xml );
        }

        // Apply postFilter
        if ( postFilter ) {
            temp = condense( matcherOut, postMap );
            postFilter( temp, [], context, xml );

            // Un-match failing elements by moving them back to matcherIn
            i = temp.length;
            while ( i-- ) {
                if ( (elem = temp[i]) ) {
                    matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
                }
            }
        }

        if ( seed ) {
            if ( postFinder || preFilter ) {
                if ( postFinder ) {
                    // Get the final matcherOut by condensing this intermediate into postFinder contexts
                    temp = [];
                    i = matcherOut.length;
                    while ( i-- ) {
                        if ( (elem = matcherOut[i]) ) {
                            // Restore matcherIn since elem is not yet a final match
                            temp.push( (matcherIn[i] = elem) );
                        }
                    }
                    postFinder( null, (matcherOut = []), temp, xml );
                }

                // Move matched elements from seed to results to keep them synchronized
                i = matcherOut.length;
                while ( i-- ) {
                    if ( (elem = matcherOut[i]) &&
                        (temp = postFinder ? indexOf.call( seed, elem ) : preMap[i]) > -1 ) {

                        seed[temp] = !(results[temp] = elem);
                    }
                }
            }

        // Add elements to results, through postFinder if defined
        } else {
            matcherOut = condense(
                matcherOut === results ?
                    matcherOut.splice( preexisting, matcherOut.length ) :
                    matcherOut
            );
            if ( postFinder ) {
                postFinder( null, results, matcherOut, xml );
            } else {
                push.apply( results, matcherOut );
            }
        }
    });
}

function matcherFromTokens( tokens ) {
    var checkContext, matcher, j,
        len = tokens.length,
        leadingRelative = Expr.relative[ tokens[0].type ],
        implicitRelative = leadingRelative || Expr.relative[" "],
        i = leadingRelative ? 1 : 0,

        // The foundational matcher ensures that elements are reachable from top-level context(s)
        matchContext = addCombinator( function( elem ) {
            return elem === checkContext;
        }, implicitRelative, true ),
        matchAnyContext = addCombinator( function( elem ) {
            return indexOf.call( checkContext, elem ) > -1;
        }, implicitRelative, true ),
        matchers = [ function( elem, context, xml ) {
            return ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
                (checkContext = context).nodeType ?
                    matchContext( elem, context, xml ) :
                    matchAnyContext( elem, context, xml ) );
        } ];

    for ( ; i < len; i++ ) {
        if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
            matchers = [ addCombinator( elementMatcher( matchers ), matcher ) ];
        } else {
            matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

            // Return special upon seeing a positional matcher
            if ( matcher[ expando ] ) {
                // Find the next relative operator (if any) for proper handling
                j = ++i;
                for ( ; j < len; j++ ) {
                    if ( Expr.relative[ tokens[j].type ] ) {
                        break;
                    }
                }
                return setMatcher(
                    i > 1 && elementMatcher( matchers ),
                    i > 1 && tokens.slice( 0, i - 1 ).join("").replace( rtrim, "$1" ),
                    matcher,
                    i < j && matcherFromTokens( tokens.slice( i, j ) ),
                    j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
                    j < len && tokens.join("")
                );
            }
            matchers.push( matcher );
        }
    }

    return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
    var bySet = setMatchers.length > 0,
        byElement = elementMatchers.length > 0,
        superMatcher = function( seed, context, xml, results, expandContext ) {
            var elem, j, matcher,
                setMatched = [],
                matchedCount = 0,
                i = "0",
                unmatched = seed && [],
                outermost = expandContext != null,
                contextBackup = outermostContext,
                // We must always have either seed elements or context
                elems = seed || byElement && Expr.find["TAG"]( "*", expandContext && context.parentNode || context ),
                // Nested matchers should use non-integer dirruns
                dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.E);

            if ( outermost ) {
                outermostContext = context !== document && context;
                cachedruns = superMatcher.el;
            }

            // Add elements passing elementMatchers directly to results
            for ( ; (elem = elems[i]) != null; i++ ) {
                if ( byElement && elem ) {
                    for ( j = 0; (matcher = elementMatchers[j]); j++ ) {
                        if ( matcher( elem, context, xml ) ) {
                            results.push( elem );
                            break;
                        }
                    }
                    if ( outermost ) {
                        dirruns = dirrunsUnique;
                        cachedruns = ++superMatcher.el;
                    }
                }

                // Track unmatched elements for set filters
                if ( bySet ) {
                    // They will have gone through all possible matchers
                    if ( (elem = !matcher && elem) ) {
                        matchedCount--;
                    }

                    // Lengthen the array for every element, matched or not
                    if ( seed ) {
                        unmatched.push( elem );
                    }
                }
            }

            // Apply set filters to unmatched elements
            matchedCount += i;
            if ( bySet && i !== matchedCount ) {
                for ( j = 0; (matcher = setMatchers[j]); j++ ) {
                    matcher( unmatched, setMatched, context, xml );
                }

                if ( seed ) {
                    // Reintegrate element matches to eliminate the need for sorting
                    if ( matchedCount > 0 ) {
                        while ( i-- ) {
                            if ( !(unmatched[i] || setMatched[i]) ) {
                                setMatched[i] = pop.call( results );
                            }
                        }
                    }

                    // Discard index placeholder values to get only actual matches
                    setMatched = condense( setMatched );
                }

                // Add matches to results
                push.apply( results, setMatched );

                // Seedless set matches succeeding multiple successful matchers stipulate sorting
                if ( outermost && !seed && setMatched.length > 0 &&
                    ( matchedCount + setMatchers.length ) > 1 ) {

                    Sizzle.uniqueSort( results );
                }
            }

            // Override manipulation of globals by nested matchers
            if ( outermost ) {
                dirruns = dirrunsUnique;
                outermostContext = contextBackup;
            }

            return unmatched;
        };

    superMatcher.el = 0;
    return bySet ?
        markFunction( superMatcher ) :
        superMatcher;
}

compile = Sizzle.compile = function( selector, group /* Internal Use Only */ ) {
    var i,
        setMatchers = [],
        elementMatchers = [],
        cached = compilerCache[ expando ][ selector + " " ];

    if ( !cached ) {
        // Generate a function of recursive functions that can be used to check each element
        if ( !group ) {
            group = tokenize( selector );
        }
        i = group.length;
        while ( i-- ) {
            cached = matcherFromTokens( group[i] );
            if ( cached[ expando ] ) {
                setMatchers.push( cached );
            } else {
                elementMatchers.push( cached );
            }
        }

        // Cache the compiled function
        cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );
    }
    return cached;
};

function multipleContexts( selector, contexts, results ) {
    var i = 0,
        len = contexts.length;
    for ( ; i < len; i++ ) {
        Sizzle( selector, contexts[i], results );
    }
    return results;
}

function select( selector, context, results, seed, xml ) {
    var i, tokens, token, type, find,
        match = tokenize( selector ),
        j = match.length;

    if ( !seed ) {
        // Try to minimize operations if there is only one group
        if ( match.length === 1 ) {

            // Take a shortcut and set the context if the root selector is an ID
            tokens = match[0] = match[0].slice( 0 );
            if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
                    context.nodeType === 9 && !xml &&
                    Expr.relative[ tokens[1].type ] ) {

                context = Expr.find["ID"]( token.matches[0].replace( rbackslash, "" ), context, xml )[0];
                if ( !context ) {
                    return results;
                }

                selector = selector.slice( tokens.shift().length );
            }

            // Fetch a seed set for right-to-left matching
            for ( i = matchExpr["POS"].test( selector ) ? -1 : tokens.length - 1; i >= 0; i-- ) {
                token = tokens[i];

                // Abort if we hit a combinator
                if ( Expr.relative[ (type = token.type) ] ) {
                    break;
                }
                if ( (find = Expr.find[ type ]) ) {
                    // Search, expanding context for leading sibling combinators
                    if ( (seed = find(
                        token.matches[0].replace( rbackslash, "" ),
                        rsibling.test( tokens[0].type ) && context.parentNode || context,
                        xml
                    )) ) {

                        // If seed is empty or no tokens remain, we can return early
                        tokens.splice( i, 1 );
                        selector = seed.length && tokens.join("");
                        if ( !selector ) {
                            push.apply( results, slice.call( seed, 0 ) );
                            return results;
                        }

                        break;
                    }
                }
            }
        }
    }

    // Compile and execute a filtering function
    // Provide `match` to avoid retokenization if we modified the selector above
    compile( selector, match )(
        seed,
        context,
        xml,
        results,
        rsibling.test( selector )
    );
    return results;
}

if ( document.querySelectorAll ) {
    (function() {
        var disconnectedMatch,
            oldSelect = select,
            rescape = /'|\\/g,
            rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,

            // qSa(:focus) reports false when true (Chrome 21), no need to also add to buggyMatches since matches checks buggyQSA
            // A support test would require too much code (would include document ready)
            rbuggyQSA = [ ":focus" ],

            // matchesSelector(:active) reports false when true (IE9/Opera 11.5)
            // A support test would require too much code (would include document ready)
            // just skip matchesSelector for :active
            rbuggyMatches = [ ":active" ],
            matches = docElem.matchesSelector ||
                docElem.mozMatchesSelector ||
                docElem.webkitMatchesSelector ||
                docElem.oMatchesSelector ||
                docElem.msMatchesSelector;

        // Build QSA regex
        // Regex strategy adopted from Diego Perini
        assert(function( div ) {
            // Select is set to empty string on purpose
            // This is to test IE's treatment of not explictly
            // setting a boolean content attribute,
            // since its presence should be enough
            // http://bugs.jquery.com/ticket/12359
            div.innerHTML = "<select><option selected=''></option></select>";

            // IE8 - Some boolean attributes are not treated correctly
            if ( !div.querySelectorAll("[selected]").length ) {
                rbuggyQSA.push( "\\[" + whitespace + "*(?:checked|disabled|ismap|multiple|readonly|selected|value)" );
            }

            // Webkit/Opera - :checked should return selected option elements
            // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
            // IE8 throws error here (do not put tests after this one)
            if ( !div.querySelectorAll(":checked").length ) {
                rbuggyQSA.push(":checked");
            }
        });

        assert(function( div ) {

            // Opera 10-12/IE9 - ^= $= *= and empty values
            // Should not select anything
            div.innerHTML = "<p test=''></p>";
            if ( div.querySelectorAll("[test^='']").length ) {
                rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:\"\"|'')" );
            }

            // FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
            // IE8 throws error here (do not put tests after this one)
            div.innerHTML = "<input type='hidden'/>";
            if ( !div.querySelectorAll(":enabled").length ) {
                rbuggyQSA.push(":enabled", ":disabled");
            }
        });

        // rbuggyQSA always contains :focus, so no need for a length check
        rbuggyQSA = /* rbuggyQSA.length && */ new RegExp( rbuggyQSA.join("|") );

        select = function( selector, context, results, seed, xml ) {
            // Only use querySelectorAll when not filtering,
            // when this is not xml,
            // and when no QSA bugs apply
            if ( !seed && !xml && !rbuggyQSA.test( selector ) ) {
                var groups, i,
                    old = true,
                    nid = expando,
                    newContext = context,
                    newSelector = context.nodeType === 9 && selector;

                // qSA works strangely on Element-rooted queries
                // We can work around this by specifying an extra ID on the root
                // and working up from there (Thanks to Andrew Dupont for the technique)
                // IE 8 doesn't work on object elements
                if ( context.nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
                    groups = tokenize( selector );

                    if ( (old = context.getAttribute("id")) ) {
                        nid = old.replace( rescape, "\\$&" );
                    } else {
                        context.setAttribute( "id", nid );
                    }
                    nid = "[id='" + nid + "'] ";

                    i = groups.length;
                    while ( i-- ) {
                        groups[i] = nid + groups[i].join("");
                    }
                    newContext = rsibling.test( selector ) && context.parentNode || context;
                    newSelector = groups.join(",");
                }

                if ( newSelector ) {
                    try {
                        push.apply( results, slice.call( newContext.querySelectorAll(
                            newSelector
                        ), 0 ) );
                        return results;
                    } catch(qsaError) {
                    } finally {
                        if ( !old ) {
                            context.removeAttribute("id");
                        }
                    }
                }
            }

            return oldSelect( selector, context, results, seed, xml );
        };

        if ( matches ) {
            assert(function( div ) {
                // Check to see if it's possible to do matchesSelector
                // on a disconnected node (IE 9)
                disconnectedMatch = matches.call( div, "div" );

                // This should fail with an exception
                // Gecko does not error, returns false instead
                try {
                    matches.call( div, "[test!='']:sizzle" );
                    rbuggyMatches.push( "!=", pseudos );
                } catch ( e ) {}
            });

            // rbuggyMatches always contains :active and :focus, so no need for a length check
            rbuggyMatches = /* rbuggyMatches.length && */ new RegExp( rbuggyMatches.join("|") );

            Sizzle.matchesSelector = function( elem, expr ) {
                // Make sure that attribute selectors are quoted
                expr = expr.replace( rattributeQuotes, "='$1']" );

                // rbuggyMatches always contains :active, so no need for an existence check
                if ( !isXML( elem ) && !rbuggyMatches.test( expr ) && !rbuggyQSA.test( expr ) ) {
                    try {
                        var ret = matches.call( elem, expr );

                        // IE 9's matchesSelector returns false on disconnected nodes
                        if ( ret || disconnectedMatch ||
                                // As well, disconnected nodes are said to be in a document
                                // fragment in IE 9
                                elem.document && elem.document.nodeType !== 11 ) {
                            return ret;
                        }
                    } catch(e) {}
                }

                return Sizzle( expr, null, null, [ elem ] ).length > 0;
            };
        }
    })();
}

// Deprecated
Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Back-compat
function setFilters() {}
Expr.filters = setFilters.prototype = Expr.pseudos;
Expr.setFilters = new setFilters();

// Override sizzle attribute retrieval
Sizzle.attr = jQuery.attr;
jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.pseudos;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;


})( window );
var runtil = /Until$/,
    rparentsprev = /^(?:parents|prev(?:Until|All))/,
    isSimple = /^.[^:#\[\.,]*$/,
    rneedsContext = jQuery.expr.match.needsContext,
    // methods guaranteed to produce a unique set when starting from a unique set
    guaranteedUnique = {
        children: true,
        contents: true,
        next: true,
        prev: true
    };

jQuery.fn.extend({
    find: function( selector ) {
        var i, l, length, n, r, ret,
            self = this;

        if ( typeof selector !== "string" ) {
            return jQuery( selector ).filter(function() {
                for ( i = 0, l = self.length; i < l; i++ ) {
                    if ( jQuery.contains( self[ i ], this ) ) {
                        return true;
                    }
                }
            });
        }

        ret = this.pushStack( "", "find", selector );

        for ( i = 0, l = this.length; i < l; i++ ) {
            length = ret.length;
            jQuery.find( selector, this[i], ret );

            if ( i > 0 ) {
                // Make sure that the results are unique
                for ( n = length; n < ret.length; n++ ) {
                    for ( r = 0; r < length; r++ ) {
                        if ( ret[r] === ret[n] ) {
                            ret.splice(n--, 1);
                            break;
                        }
                    }
                }
            }
        }

        return ret;
    },

    has: function( target ) {
        var i,
            targets = jQuery( target, this ),
            len = targets.length;

        return this.filter(function() {
            for ( i = 0; i < len; i++ ) {
                if ( jQuery.contains( this, targets[i] ) ) {
                    return true;
                }
            }
        });
    },

    not: function( selector ) {
        return this.pushStack( winnow(this, selector, false), "not", selector);
    },

    filter: function( selector ) {
        return this.pushStack( winnow(this, selector, true), "filter", selector );
    },

    is: function( selector ) {
        return !!selector && (
            typeof selector === "string" ?
                // If this is a positional/relative selector, check membership in the returned set
                // so $("p:first").is("p:last") won't return true for a doc with two "p".
                rneedsContext.test( selector ) ?
                    jQuery( selector, this.context ).index( this[0] ) >= 0 :
                    jQuery.filter( selector, this ).length > 0 :
                this.filter( selector ).length > 0 );
    },

    closest: function( selectors, context ) {
        var cur,
            i = 0,
            l = this.length,
            ret = [],
            pos = rneedsContext.test( selectors ) || typeof selectors !== "string" ?
                jQuery( selectors, context || this.context ) :
                0;

        for ( ; i < l; i++ ) {
            cur = this[i];

            while ( cur && cur.ownerDocument && cur !== context && cur.nodeType !== 11 ) {
                if ( pos ? pos.index(cur) > -1 : jQuery.find.matchesSelector(cur, selectors) ) {
                    ret.push( cur );
                    break;
                }
                cur = cur.parentNode;
            }
        }

        ret = ret.length > 1 ? jQuery.unique( ret ) : ret;

        return this.pushStack( ret, "closest", selectors );
    },

    // Determine the position of an element within
    // the matched set of elements
    index: function( elem ) {

        // No argument, return index in parent
        if ( !elem ) {
            return ( this[0] && this[0].parentNode ) ? this.prevAll().length : -1;
        }

        // index in selector
        if ( typeof elem === "string" ) {
            return jQuery.inArray( this[0], jQuery( elem ) );
        }

        // Locate the position of the desired element
        return jQuery.inArray(
            // If it receives a jQuery object, the first element is used
            elem.jquery ? elem[0] : elem, this );
    },

    add: function( selector, context ) {
        var set = typeof selector === "string" ?
                jQuery( selector, context ) :
                jQuery.makeArray( selector && selector.nodeType ? [ selector ] : selector ),
            all = jQuery.merge( this.get(), set );

        return this.pushStack( isDisconnected( set[0] ) || isDisconnected( all[0] ) ?
            all :
            jQuery.unique( all ) );
    },

    addBack: function( selector ) {
        return this.add( selector == null ?
            this.prevObject : this.prevObject.filter(selector)
        );
    }
});

jQuery.fn.andSelf = jQuery.fn.addBack;

// A painfully simple check to see if an element is disconnected
// from a document (should be improved, where feasible).
function isDisconnected( node ) {
    return !node || !node.parentNode || node.parentNode.nodeType === 11;
}

function sibling( cur, dir ) {
    do {
        cur = cur[ dir ];
    } while ( cur && cur.nodeType !== 1 );

    return cur;
}

jQuery.each({
    parent: function( elem ) {
        var parent = elem.parentNode;
        return parent && parent.nodeType !== 11 ? parent : null;
    },
    parents: function( elem ) {
        return jQuery.dir( elem, "parentNode" );
    },
    parentsUntil: function( elem, i, until ) {
        return jQuery.dir( elem, "parentNode", until );
    },
    next: function( elem ) {
        return sibling( elem, "nextSibling" );
    },
    prev: function( elem ) {
        return sibling( elem, "previousSibling" );
    },
    nextAll: function( elem ) {
        return jQuery.dir( elem, "nextSibling" );
    },
    prevAll: function( elem ) {
        return jQuery.dir( elem, "previousSibling" );
    },
    nextUntil: function( elem, i, until ) {
        return jQuery.dir( elem, "nextSibling", until );
    },
    prevUntil: function( elem, i, until ) {
        return jQuery.dir( elem, "previousSibling", until );
    },
    siblings: function( elem ) {
        return jQuery.sibling( ( elem.parentNode || {} ).firstChild, elem );
    },
    children: function( elem ) {
        return jQuery.sibling( elem.firstChild );
    },
    contents: function( elem ) {
        return jQuery.nodeName( elem, "iframe" ) ?
            elem.contentDocument || elem.contentWindow.document :
            jQuery.merge( [], elem.childNodes );
    }
}, function( name, fn ) {
    jQuery.fn[ name ] = function( until, selector ) {
        var ret = jQuery.map( this, fn, until );

        if ( !runtil.test( name ) ) {
            selector = until;
        }

        if ( selector && typeof selector === "string" ) {
            ret = jQuery.filter( selector, ret );
        }

        ret = this.length > 1 && !guaranteedUnique[ name ] ? jQuery.unique( ret ) : ret;

        if ( this.length > 1 && rparentsprev.test( name ) ) {
            ret = ret.reverse();
        }

        return this.pushStack( ret, name, core_slice.call( arguments ).join(",") );
    };
});

jQuery.extend({
    filter: function( expr, elems, not ) {
        if ( not ) {
            expr = ":not(" + expr + ")";
        }

        return elems.length === 1 ?
            jQuery.find.matchesSelector(elems[0], expr) ? [ elems[0] ] : [] :
            jQuery.find.matches(expr, elems);
    },

    dir: function( elem, dir, until ) {
        var matched = [],
            cur = elem[ dir ];

        while ( cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !jQuery( cur ).is( until )) ) {
            if ( cur.nodeType === 1 ) {
                matched.push( cur );
            }
            cur = cur[dir];
        }
        return matched;
    },

    sibling: function( n, elem ) {
        var r = [];

        for ( ; n; n = n.nextSibling ) {
            if ( n.nodeType === 1 && n !== elem ) {
                r.push( n );
            }
        }

        return r;
    }
});

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, keep ) {

    // Can't pass null or undefined to indexOf in Firefox 4
    // Set to 0 to skip string check
    qualifier = qualifier || 0;

    if ( jQuery.isFunction( qualifier ) ) {
        return jQuery.grep(elements, function( elem, i ) {
            var retVal = !!qualifier.call( elem, i, elem );
            return retVal === keep;
        });

    } else if ( qualifier.nodeType ) {
        return jQuery.grep(elements, function( elem, i ) {
            return ( elem === qualifier ) === keep;
        });

    } else if ( typeof qualifier === "string" ) {
        var filtered = jQuery.grep(elements, function( elem ) {
            return elem.nodeType === 1;
        });

        if ( isSimple.test( qualifier ) ) {
            return jQuery.filter(qualifier, filtered, !keep);
        } else {
            qualifier = jQuery.filter( qualifier, filtered );
        }
    }

    return jQuery.grep(elements, function( elem, i ) {
        return ( jQuery.inArray( elem, qualifier ) >= 0 ) === keep;
    });
}
function createSafeFragment( document ) {
    var list = nodeNames.split( "|" ),
    safeFrag = document.createDocumentFragment();

    if ( safeFrag.createElement ) {
        while ( list.length ) {
            safeFrag.createElement(
                list.pop()
            );
        }
    }
    return safeFrag;
}

var nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
        "header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
    rinlinejQuery = / jQuery\d+="(?:null|\d+)"/g,
    rleadingWhitespace = /^\s+/,
    rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
    rtagName = /<([\w:]+)/,
    rtbody = /<tbody/i,
    rhtml = /<|&#?\w+;/,
    rnoInnerhtml = /<(?:script|style|link)/i,
    rnocache = /<(?:script|object|embed|option|style)/i,
    rnoshimcache = new RegExp("<(?:" + nodeNames + ")[\\s/>]", "i"),
    rcheckableType = /^(?:checkbox|radio)$/,
    // checked="checked" or checked
    rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
    rscriptType = /\/(java|ecma)script/i,
    rcleanScript = /^\s*<!(?:\[CDATA\[|\-\-)|[\]\-]{2}>\s*$/g,
    wrapMap = {
        option: [ 1, "<select multiple='multiple'>", "</select>" ],
        legend: [ 1, "<fieldset>", "</fieldset>" ],
        thead: [ 1, "<table>", "</table>" ],
        tr: [ 2, "<table><tbody>", "</tbody></table>" ],
        td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
        col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
        area: [ 1, "<map>", "</map>" ],
        _default: [ 0, "", "" ]
    },
    safeFragment = createSafeFragment( document ),
    fragmentDiv = safeFragment.appendChild( document.createElement("div") );

wrapMap.optgroup = wrapMap.option;
wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// IE6-8 can't serialize link, script, style, or any html5 (NoScope) tags,
// unless wrapped in a div with non-breaking characters in front of it.
if ( !jQuery.support.htmlSerialize ) {
    wrapMap._default = [ 1, "X<div>", "</div>" ];
}

jQuery.fn.extend({
    text: function( value ) {
        return jQuery.access( this, function( value ) {
            return value === undefined ?
                jQuery.text( this ) :
                this.empty().append( ( this[0] && this[0].ownerDocument || document ).createTextNode( value ) );
        }, null, value, arguments.length );
    },

    wrapAll: function( html ) {
        if ( jQuery.isFunction( html ) ) {
            return this.each(function(i) {
                jQuery(this).wrapAll( html.call(this, i) );
            });
        }

        if ( this[0] ) {
            // The elements to wrap the target around
            var wrap = jQuery( html, this[0].ownerDocument ).eq(0).clone(true);

            if ( this[0].parentNode ) {
                wrap.insertBefore( this[0] );
            }

            wrap.map(function() {
                var elem = this;

                while ( elem.firstChild && elem.firstChild.nodeType === 1 ) {
                    elem = elem.firstChild;
                }

                return elem;
            }).append( this );
        }

        return this;
    },

    wrapInner: function( html ) {
        if ( jQuery.isFunction( html ) ) {
            return this.each(function(i) {
                jQuery(this).wrapInner( html.call(this, i) );
            });
        }

        return this.each(function() {
            var self = jQuery( this ),
                contents = self.contents();

            if ( contents.length ) {
                contents.wrapAll( html );

            } else {
                self.append( html );
            }
        });
    },

    wrap: function( html ) {
        var isFunction = jQuery.isFunction( html );

        return this.each(function(i) {
            jQuery( this ).wrapAll( isFunction ? html.call(this, i) : html );
        });
    },

    unwrap: function() {
        return this.parent().each(function() {
            if ( !jQuery.nodeName( this, "body" ) ) {
                jQuery( this ).replaceWith( this.childNodes );
            }
        }).end();
    },

    append: function() {
        return this.domManip(arguments, true, function( elem ) {
            if ( this.nodeType === 1 || this.nodeType === 11 ) {
                this.appendChild( elem );
            }
        });
    },

    prepend: function() {
        return this.domManip(arguments, true, function( elem ) {
            if ( this.nodeType === 1 || this.nodeType === 11 ) {
                this.insertBefore( elem, this.firstChild );
            }
        });
    },

    before: function() {
        if ( !isDisconnected( this[0] ) ) {
            return this.domManip(arguments, false, function( elem ) {
                this.parentNode.insertBefore( elem, this );
            });
        }

        if ( arguments.length ) {
            var set = jQuery.clean( arguments );
            return this.pushStack( jQuery.merge( set, this ), "before", this.selector );
        }
    },

    after: function() {
        if ( !isDisconnected( this[0] ) ) {
            return this.domManip(arguments, false, function( elem ) {
                this.parentNode.insertBefore( elem, this.nextSibling );
            });
        }

        if ( arguments.length ) {
            var set = jQuery.clean( arguments );
            return this.pushStack( jQuery.merge( this, set ), "after", this.selector );
        }
    },

    // keepData is for internal use only--do not document
    remove: function( selector, keepData ) {
        var elem,
            i = 0;

        for ( ; (elem = this[i]) != null; i++ ) {
            if ( !selector || jQuery.filter( selector, [ elem ] ).length ) {
                if ( !keepData && elem.nodeType === 1 ) {
                    jQuery.cleanData( elem.getElementsByTagName("*") );
                    jQuery.cleanData( [ elem ] );
                }

                if ( elem.parentNode ) {
                    elem.parentNode.removeChild( elem );
                }
            }
        }

        return this;
    },

    empty: function() {
        var elem,
            i = 0;

        for ( ; (elem = this[i]) != null; i++ ) {
            // Remove element nodes and prevent memory leaks
            if ( elem.nodeType === 1 ) {
                jQuery.cleanData( elem.getElementsByTagName("*") );
            }

            // Remove any remaining nodes
            while ( elem.firstChild ) {
                elem.removeChild( elem.firstChild );
            }
        }

        return this;
    },

    clone: function( dataAndEvents, deepDataAndEvents ) {
        dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
        deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

        return this.map( function () {
            return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
        });
    },

    html: function( value ) {
        return jQuery.access( this, function( value ) {
            var elem = this[0] || {},
                i = 0,
                l = this.length;

            if ( value === undefined ) {
                return elem.nodeType === 1 ?
                    elem.innerHTML.replace( rinlinejQuery, "" ) :
                    undefined;
            }

            // See if we can take a shortcut and just use innerHTML
            if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
                ( jQuery.support.htmlSerialize || !rnoshimcache.test( value )  ) &&
                ( jQuery.support.leadingWhitespace || !rleadingWhitespace.test( value ) ) &&
                !wrapMap[ ( rtagName.exec( value ) || ["", ""] )[1].toLowerCase() ] ) {

                value = value.replace( rxhtmlTag, "<$1></$2>" );

                try {
                    for (; i < l; i++ ) {
                        // Remove element nodes and prevent memory leaks
                        elem = this[i] || {};
                        if ( elem.nodeType === 1 ) {
                            jQuery.cleanData( elem.getElementsByTagName( "*" ) );
                            elem.innerHTML = value;
                        }
                    }

                    elem = 0;

                // If using innerHTML throws an exception, use the fallback method
                } catch(e) {}
            }

            if ( elem ) {
                this.empty().append( value );
            }
        }, null, value, arguments.length );
    },

    replaceWith: function( value ) {
        if ( !isDisconnected( this[0] ) ) {
            // Make sure that the elements are removed from the DOM before they are inserted
            // this can help fix replacing a parent with child elements
            if ( jQuery.isFunction( value ) ) {
                return this.each(function(i) {
                    var self = jQuery(this), old = self.html();
                    self.replaceWith( value.call( this, i, old ) );
                });
            }

            if ( typeof value !== "string" ) {
                value = jQuery( value ).detach();
            }

            return this.each(function() {
                var next = this.nextSibling,
                    parent = this.parentNode;

                jQuery( this ).remove();

                if ( next ) {
                    jQuery(next).before( value );
                } else {
                    jQuery(parent).append( value );
                }
            });
        }

        return this.length ?
            this.pushStack( jQuery(jQuery.isFunction(value) ? value() : value), "replaceWith", value ) :
            this;
    },

    detach: function( selector ) {
        return this.remove( selector, true );
    },

    domManip: function( args, table, callback ) {

        // Flatten any nested arrays
        args = [].concat.apply( [], args );

        var results, first, fragment, iNoClone,
            i = 0,
            value = args[0],
            scripts = [],
            l = this.length;

        // We can't cloneNode fragments that contain checked, in WebKit
        if ( !jQuery.support.checkClone && l > 1 && typeof value === "string" && rchecked.test( value ) ) {
            return this.each(function() {
                jQuery(this).domManip( args, table, callback );
            });
        }

        if ( jQuery.isFunction(value) ) {
            return this.each(function(i) {
                var self = jQuery(this);
                args[0] = value.call( this, i, table ? self.html() : undefined );
                self.domManip( args, table, callback );
            });
        }

        if ( this[0] ) {
            results = jQuery.buildFragment( args, this, scripts );
            fragment = results.fragment;
            first = fragment.firstChild;

            if ( fragment.childNodes.length === 1 ) {
                fragment = first;
            }

            if ( first ) {
                table = table && jQuery.nodeName( first, "tr" );

                // Use the original fragment for the last item instead of the first because it can end up
                // being emptied incorrectly in certain situations (#8070).
                // Fragments from the fragment cache must always be cloned and never used in place.
                for ( iNoClone = results.cacheable || l - 1; i < l; i++ ) {
                    callback.call(
                        table && jQuery.nodeName( this[i], "table" ) ?
                            findOrAppend( this[i], "tbody" ) :
                            this[i],
                        i === iNoClone ?
                            fragment :
                            jQuery.clone( fragment, true, true )
                    );
                }
            }

            // Fix #11809: Avoid leaking memory
            fragment = first = null;

            if ( scripts.length ) {
                jQuery.each( scripts, function( i, elem ) {
                    if ( elem.src ) {
                        if ( jQuery.ajax ) {
                            jQuery.ajax({
                                url: elem.src,
                                type: "GET",
                                dataType: "script",
                                async: false,
                                global: false,
                                "throws": true
                            });
                        } else {
                            jQuery.error("no ajax");
                        }
                    } else {
                        jQuery.globalEval( ( elem.text || elem.textContent || elem.innerHTML || "" ).replace( rcleanScript, "" ) );
                    }

                    if ( elem.parentNode ) {
                        elem.parentNode.removeChild( elem );
                    }
                });
            }
        }

        return this;
    }
});

function findOrAppend( elem, tag ) {
    return elem.getElementsByTagName( tag )[0] || elem.appendChild( elem.ownerDocument.createElement( tag ) );
}

function cloneCopyEvent( src, dest ) {

    if ( dest.nodeType !== 1 || !jQuery.hasData( src ) ) {
        return;
    }

    var type, i, l,
        oldData = jQuery._data( src ),
        curData = jQuery._data( dest, oldData ),
        events = oldData.events;

    if ( events ) {
        delete curData.handle;
        curData.events = {};

        for ( type in events ) {
            for ( i = 0, l = events[ type ].length; i < l; i++ ) {
                jQuery.event.add( dest, type, events[ type ][ i ] );
            }
        }
    }

    // make the cloned public data object a copy from the original
    if ( curData.data ) {
        curData.data = jQuery.extend( {}, curData.data );
    }
}

function cloneFixAttributes( src, dest ) {
    var nodeName;

    // We do not need to do anything for non-Elements
    if ( dest.nodeType !== 1 ) {
        return;
    }

    // clearAttributes removes the attributes, which we don't want,
    // but also removes the attachEvent events, which we *do* want
    if ( dest.clearAttributes ) {
        dest.clearAttributes();
    }

    // mergeAttributes, in contrast, only merges back on the
    // original attributes, not the events
    if ( dest.mergeAttributes ) {
        dest.mergeAttributes( src );
    }

    nodeName = dest.nodeName.toLowerCase();

    if ( nodeName === "object" ) {
        // IE6-10 improperly clones children of object elements using classid.
        // IE10 throws NoModificationAllowedError if parent is null, #12132.
        if ( dest.parentNode ) {
            dest.outerHTML = src.outerHTML;
        }

        // This path appears unavoidable for IE9. When cloning an object
        // element in IE9, the outerHTML strategy above is not sufficient.
        // If the src has innerHTML and the destination does not,
        // copy the src.innerHTML into the dest.innerHTML. #10324
        if ( jQuery.support.html5Clone && (src.innerHTML && !jQuery.trim(dest.innerHTML)) ) {
            dest.innerHTML = src.innerHTML;
        }

    } else if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
        // IE6-8 fails to persist the checked state of a cloned checkbox
        // or radio button. Worse, IE6-7 fail to give the cloned element
        // a checked appearance if the defaultChecked value isn't also set

        dest.defaultChecked = dest.checked = src.checked;

        // IE6-7 get confused and end up setting the value of a cloned
        // checkbox/radio button to an empty string instead of "on"
        if ( dest.value !== src.value ) {
            dest.value = src.value;
        }

    // IE6-8 fails to return the selected option to the default selected
    // state when cloning options
    } else if ( nodeName === "option" ) {
        dest.selected = src.defaultSelected;

    // IE6-8 fails to set the defaultValue to the correct value when
    // cloning other types of input fields
    } else if ( nodeName === "input" || nodeName === "textarea" ) {
        dest.defaultValue = src.defaultValue;

    // IE blanks contents when cloning scripts
    } else if ( nodeName === "script" && dest.text !== src.text ) {
        dest.text = src.text;
    }

    // Event data gets referenced instead of copied if the expando
    // gets copied too
    dest.removeAttribute( jQuery.expando );
}

jQuery.buildFragment = function( args, context, scripts ) {
    var fragment, cacheable, cachehit,
        first = args[ 0 ];

    // Set context from what may come in as undefined or a jQuery collection or a node
    // Updated to fix #12266 where accessing context[0] could throw an exception in IE9/10 &
    // also doubles as fix for #8950 where plain objects caused createDocumentFragment exception
    context = context || document;
    context = !context.nodeType && context[0] || context;
    context = context.ownerDocument || context;

    // Only cache "small" (1/2 KB) HTML strings that are associated with the main document
    // Cloning options loses the selected state, so don't cache them
    // IE 6 doesn't like it when you put <object> or <embed> elements in a fragment
    // Also, WebKit does not clone 'checked' attributes on cloneNode, so don't cache
    // Lastly, IE6,7,8 will not correctly reuse cached fragments that were created from unknown elems #10501
    if ( args.length === 1 && typeof first === "string" && first.length < 512 && context === document &&
        first.charAt(0) === "<" && !rnocache.test( first ) &&
        (jQuery.support.checkClone || !rchecked.test( first )) &&
        (jQuery.support.html5Clone || !rnoshimcache.test( first )) ) {

        // Mark cacheable and look for a hit
        cacheable = true;
        fragment = jQuery.fragments[ first ];
        cachehit = fragment !== undefined;
    }

    if ( !fragment ) {
        fragment = context.createDocumentFragment();
        jQuery.clean( args, context, fragment, scripts );

        // Update the cache, but only store false
        // unless this is a second parsing of the same content
        if ( cacheable ) {
            jQuery.fragments[ first ] = cachehit && fragment;
        }
    }

    return { fragment: fragment, cacheable: cacheable };
};

jQuery.fragments = {};

jQuery.each({
    appendTo: "append",
    prependTo: "prepend",
    insertBefore: "before",
    insertAfter: "after",
    replaceAll: "replaceWith"
}, function( name, original ) {
    jQuery.fn[ name ] = function( selector ) {
        var elems,
            i = 0,
            ret = [],
            insert = jQuery( selector ),
            l = insert.length,
            parent = this.length === 1 && this[0].parentNode;

        if ( (parent == null || parent && parent.nodeType === 11 && parent.childNodes.length === 1) && l === 1 ) {
            insert[ original ]( this[0] );
            return this;
        } else {
            for ( ; i < l; i++ ) {
                elems = ( i > 0 ? this.clone(true) : this ).get();
                jQuery( insert[i] )[ original ]( elems );
                ret = ret.concat( elems );
            }

            return this.pushStack( ret, name, insert.selector );
        }
    };
});

function getAll( elem ) {
    if ( typeof elem.getElementsByTagName !== "undefined" ) {
        return elem.getElementsByTagName( "*" );

    } else if ( typeof elem.querySelectorAll !== "undefined" ) {
        return elem.querySelectorAll( "*" );

    } else {
        return [];
    }
}

// Used in clean, fixes the defaultChecked property
function fixDefaultChecked( elem ) {
    if ( rcheckableType.test( elem.type ) ) {
        elem.defaultChecked = elem.checked;
    }
}

jQuery.extend({
    clone: function( elem, dataAndEvents, deepDataAndEvents ) {
        var srcElements,
            destElements,
            i,
            clone;

        if ( jQuery.support.html5Clone || jQuery.isXMLDoc(elem) || !rnoshimcache.test( "<" + elem.nodeName + ">" ) ) {
            clone = elem.cloneNode( true );

        // IE<=8 does not properly clone detached, unknown element nodes
        } else {
            fragmentDiv.innerHTML = elem.outerHTML;
            fragmentDiv.removeChild( clone = fragmentDiv.firstChild );
        }

        if ( (!jQuery.support.noCloneEvent || !jQuery.support.noCloneChecked) &&
                (elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem) ) {
            // IE copies events bound via attachEvent when using cloneNode.
            // Calling detachEvent on the clone will also remove the events
            // from the original. In order to get around this, we use some
            // proprietary methods to clear the events. Thanks to MooTools
            // guys for this hotness.

            cloneFixAttributes( elem, clone );

            // Using Sizzle here is crazy slow, so we use getElementsByTagName instead
            srcElements = getAll( elem );
            destElements = getAll( clone );

            // Weird iteration because IE will replace the length property
            // with an element if you are cloning the body and one of the
            // elements on the page has a name or id of "length"
            for ( i = 0; srcElements[i]; ++i ) {
                // Ensure that the destination node is not null; Fixes #9587
                if ( destElements[i] ) {
                    cloneFixAttributes( srcElements[i], destElements[i] );
                }
            }
        }

        // Copy the events from the original to the clone
        if ( dataAndEvents ) {
            cloneCopyEvent( elem, clone );

            if ( deepDataAndEvents ) {
                srcElements = getAll( elem );
                destElements = getAll( clone );

                for ( i = 0; srcElements[i]; ++i ) {
                    cloneCopyEvent( srcElements[i], destElements[i] );
                }
            }
        }

        srcElements = destElements = null;

        // Return the cloned set
        return clone;
    },

    clean: function( elems, context, fragment, scripts ) {
        var i, j, elem, tag, wrap, depth, div, hasBody, tbody, len, handleScript, jsTags,
            safe = context === document && safeFragment,
            ret = [];

        // Ensure that context is a document
        if ( !context || typeof context.createDocumentFragment === "undefined" ) {
            context = document;
        }

        // Use the already-created safe fragment if context permits
        for ( i = 0; (elem = elems[i]) != null; i++ ) {
            if ( typeof elem === "number" ) {
                elem += "";
            }

            if ( !elem ) {
                continue;
            }

            // Convert html string into DOM nodes
            if ( typeof elem === "string" ) {
                if ( !rhtml.test( elem ) ) {
                    elem = context.createTextNode( elem );
                } else {
                    // Ensure a safe container in which to render the html
                    safe = safe || createSafeFragment( context );
                    div = context.createElement("div");
                    safe.appendChild( div );

                    // Fix "XHTML"-style tags in all browsers
                    elem = elem.replace(rxhtmlTag, "<$1></$2>");

                    // Go to html and back, then peel off extra wrappers
                    tag = ( rtagName.exec( elem ) || ["", ""] )[1].toLowerCase();
                    wrap = wrapMap[ tag ] || wrapMap._default;
                    depth = wrap[0];
                    div.innerHTML = wrap[1] + elem + wrap[2];

                    // Move to the right depth
                    while ( depth-- ) {
                        div = div.lastChild;
                    }

                    // Remove IE's autoinserted <tbody> from table fragments
                    if ( !jQuery.support.tbody ) {

                        // String was a <table>, *may* have spurious <tbody>
                        hasBody = rtbody.test(elem);
                            tbody = tag === "table" && !hasBody ?
                                div.firstChild && div.firstChild.childNodes :

                                // String was a bare <thead> or <tfoot>
                                wrap[1] === "<table>" && !hasBody ?
                                    div.childNodes :
                                    [];

                        for ( j = tbody.length - 1; j >= 0 ; --j ) {
                            if ( jQuery.nodeName( tbody[ j ], "tbody" ) && !tbody[ j ].childNodes.length ) {
                                tbody[ j ].parentNode.removeChild( tbody[ j ] );
                            }
                        }
                    }

                    // IE completely kills leading whitespace when innerHTML is used
                    if ( !jQuery.support.leadingWhitespace && rleadingWhitespace.test( elem ) ) {
                        div.insertBefore( context.createTextNode( rleadingWhitespace.exec(elem)[0] ), div.firstChild );
                    }

                    elem = div.childNodes;

                    // Take out of fragment container (we need a fresh div each time)
                    div.parentNode.removeChild( div );
                }
            }

            if ( elem.nodeType ) {
                ret.push( elem );
            } else {
                jQuery.merge( ret, elem );
            }
        }

        // Fix #11356: Clear elements from safeFragment
        if ( div ) {
            elem = div = safe = null;
        }

        // Reset defaultChecked for any radios and checkboxes
        // about to be appended to the DOM in IE 6/7 (#8060)
        if ( !jQuery.support.appendChecked ) {
            for ( i = 0; (elem = ret[i]) != null; i++ ) {
                if ( jQuery.nodeName( elem, "input" ) ) {
                    fixDefaultChecked( elem );
                } else if ( typeof elem.getElementsByTagName !== "undefined" ) {
                    jQuery.grep( elem.getElementsByTagName("input"), fixDefaultChecked );
                }
            }
        }

        // Append elements to a provided document fragment
        if ( fragment ) {
            // Special handling of each script element
            handleScript = function( elem ) {
                // Check if we consider it executable
                if ( !elem.type || rscriptType.test( elem.type ) ) {
                    // Detach the script and store it in the scripts array (if provided) or the fragment
                    // Return truthy to indicate that it has been handled
                    return scripts ?
                        scripts.push( elem.parentNode ? elem.parentNode.removeChild( elem ) : elem ) :
                        fragment.appendChild( elem );
                }
            };

            for ( i = 0; (elem = ret[i]) != null; i++ ) {
                // Check if we're done after handling an executable script
                if ( !( jQuery.nodeName( elem, "script" ) && handleScript( elem ) ) ) {
                    // Append to fragment and handle embedded scripts
                    fragment.appendChild( elem );
                    if ( typeof elem.getElementsByTagName !== "undefined" ) {
                        // handleScript alters the DOM, so use jQuery.merge to ensure snapshot iteration
                        jsTags = jQuery.grep( jQuery.merge( [], elem.getElementsByTagName("script") ), handleScript );

                        // Splice the scripts into ret after their former ancestor and advance our index beyond them
                        ret.splice.apply( ret, [i + 1, 0].concat( jsTags ) );
                        i += jsTags.length;
                    }
                }
            }
        }

        return ret;
    },

    cleanData: function( elems, /* internal */ acceptData ) {
        var data, id, elem, type,
            i = 0,
            internalKey = jQuery.expando,
            cache = jQuery.cache,
            deleteExpando = jQuery.support.deleteExpando,
            special = jQuery.event.special;

        for ( ; (elem = elems[i]) != null; i++ ) {

            if ( acceptData || jQuery.acceptData( elem ) ) {

                id = elem[ internalKey ];
                data = id && cache[ id ];

                if ( data ) {
                    if ( data.events ) {
                        for ( type in data.events ) {
                            if ( special[ type ] ) {
                                jQuery.event.remove( elem, type );

                            // This is a shortcut to avoid jQuery.event.remove's overhead
                            } else {
                                jQuery.removeEvent( elem, type, data.handle );
                            }
                        }
                    }

                    // Remove cache only if it was not already removed by jQuery.event.remove
                    if ( cache[ id ] ) {

                        delete cache[ id ];

                        // IE does not allow us to delete expando properties from nodes,
                        // nor does it have a removeAttribute function on Document nodes;
                        // we must handle all of these cases
                        if ( deleteExpando ) {
                            delete elem[ internalKey ];

                        } else if ( elem.removeAttribute ) {
                            elem.removeAttribute( internalKey );

                        } else {
                            elem[ internalKey ] = null;
                        }

                        jQuery.deletedIds.push( id );
                    }
                }
            }
        }
    }
});
// Limit scope pollution from any deprecated API
(function() {

var matched, browser;

// Use of jQuery.browser is frowned upon.
// More details: http://api.jquery.com/jQuery.browser
// jQuery.uaMatch maintained for back-compat
jQuery.uaMatch = function( ua ) {
    ua = ua.toLowerCase();

    var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
        /(msie) ([\w.]+)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
        [];

    return {
        browser: match[ 1 ] || "",
        version: match[ 2 ] || "0"
    };
};

matched = jQuery.uaMatch( navigator.userAgent );
browser = {};

if ( matched.browser ) {
    browser[ matched.browser ] = true;
    browser.version = matched.version;
}

// Chrome is Webkit, but Webkit is also Safari.
if ( browser.chrome ) {
    browser.webkit = true;
} else if ( browser.webkit ) {
    browser.safari = true;
}

jQuery.browser = browser;

jQuery.sub = function() {
    function jQuerySub( selector, context ) {
        return new jQuerySub.fn.init( selector, context );
    }
    jQuery.extend( true, jQuerySub, this );
    jQuerySub.superclass = this;
    jQuerySub.fn = jQuerySub.prototype = this();
    jQuerySub.fn.constructor = jQuerySub;
    jQuerySub.sub = this.sub;
    jQuerySub.fn.init = function init( selector, context ) {
        if ( context && context instanceof jQuery && !(context instanceof jQuerySub) ) {
            context = jQuerySub( context );
        }

        return jQuery.fn.init.call( this, selector, context, rootjQuerySub );
    };
    jQuerySub.fn.init.prototype = jQuerySub.fn;
    var rootjQuerySub = jQuerySub(document);
    return jQuerySub;
};

})();
var curCSS, iframe, iframeDoc,
    ralpha = /alpha\([^)]*\)/i,
    ropacity = /opacity=([^)]*)/,
    rposition = /^(top|right|bottom|left)$/,
    // swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
    // see here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
    rdisplayswap = /^(none|table(?!-c[ea]).+)/,
    rmargin = /^margin/,
    rnumsplit = new RegExp( "^(" + core_pnum + ")(.*)$", "i" ),
    rnumnonpx = new RegExp( "^(" + core_pnum + ")(?!px)[a-z%]+$", "i" ),
    rrelNum = new RegExp( "^([-+])=(" + core_pnum + ")", "i" ),
    elemdisplay = { BODY: "block" },

    cssShow = { position: "absolute", visibility: "hidden", display: "block" },
    cssNormalTransform = {
        letterSpacing: 0,
        fontWeight: 400
    },

    cssExpand = [ "Top", "Right", "Bottom", "Left" ],
    cssPrefixes = [ "Webkit", "O", "Moz", "ms" ],

    eventsToggle = jQuery.fn.toggle;

// return a css property mapped to a potentially vendor prefixed property
function vendorPropName( style, name ) {

    // shortcut for names that are not vendor prefixed
    if ( name in style ) {
        return name;
    }

    // check for vendor prefixed names
    var capName = name.charAt(0).toUpperCase() + name.slice(1),
        origName = name,
        i = cssPrefixes.length;

    while ( i-- ) {
        name = cssPrefixes[ i ] + capName;
        if ( name in style ) {
            return name;
        }
    }

    return origName;
}

function isHidden( elem, el ) {
    elem = el || elem;
    return jQuery.css( elem, "display" ) === "none" || !jQuery.contains( elem.ownerDocument, elem );
}

function showHide( elements, show ) {
    var elem, display,
        values = [],
        index = 0,
        length = elements.length;

    for ( ; index < length; index++ ) {
        elem = elements[ index ];
        if ( !elem.style ) {
            continue;
        }
        values[ index ] = jQuery._data( elem, "olddisplay" );
        if ( show ) {
            // Reset the inline display of this element to learn if it is
            // being hidden by cascaded rules or not
            if ( !values[ index ] && elem.style.display === "none" ) {
                elem.style.display = "";
            }

            // Set elements which have been overridden with display: none
            // in a stylesheet to whatever the default browser style is
            // for such an element
            if ( elem.style.display === "" && isHidden( elem ) ) {
                values[ index ] = jQuery._data( elem, "olddisplay", css_defaultDisplay(elem.nodeName) );
            }
        } else {
            display = curCSS( elem, "display" );

            if ( !values[ index ] && display !== "none" ) {
                jQuery._data( elem, "olddisplay", display );
            }
        }
    }

    // Set the display of most of the elements in a second loop
    // to avoid the constant reflow
    for ( index = 0; index < length; index++ ) {
        elem = elements[ index ];
        if ( !elem.style ) {
            continue;
        }
        if ( !show || elem.style.display === "none" || elem.style.display === "" ) {
            elem.style.display = show ? values[ index ] || "" : "none";
        }
    }

    return elements;
}

jQuery.fn.extend({
    css: function( name, value ) {
        return jQuery.access( this, function( elem, name, value ) {
            return value !== undefined ?
                jQuery.style( elem, name, value ) :
                jQuery.css( elem, name );
        }, name, value, arguments.length > 1 );
    },
    show: function() {
        return showHide( this, true );
    },
    hide: function() {
        return showHide( this );
    },
    toggle: function( state, fn2 ) {
        var bool = typeof state === "boolean";

        if ( jQuery.isFunction( state ) && jQuery.isFunction( fn2 ) ) {
            return eventsToggle.apply( this, arguments );
        }

        return this.each(function() {
            if ( bool ? state : isHidden( this ) ) {
                jQuery( this ).show();
            } else {
                jQuery( this ).hide();
            }
        });
    }
});

jQuery.extend({
    // Add in style property hooks for overriding the default
    // behavior of getting and setting a style property
    cssHooks: {
        opacity: {
            get: function( elem, computed ) {
                if ( computed ) {
                    // We should always get a number back from opacity
                    var ret = curCSS( elem, "opacity" );
                    return ret === "" ? "1" : ret;

                }
            }
        }
    },

    // Exclude the following css properties to add px
    cssNumber: {
        "fillOpacity": true,
        "fontWeight": true,
        "lineHeight": true,
        "opacity": true,
        "orphans": true,
        "widows": true,
        "zIndex": true,
        "zoom": true
    },

    // Add in properties whose names you wish to fix before
    // setting or getting the value
    cssProps: {
        // normalize float css property
        "float": jQuery.support.cssFloat ? "cssFloat" : "styleFloat"
    },

    // Get and set the style property on a DOM Node
    style: function( elem, name, value, extra ) {
        // Don't set styles on text and comment nodes
        if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
            return;
        }

        // Make sure that we're working with the right name
        var ret, type, hooks,
            origName = jQuery.camelCase( name ),
            style = elem.style;

        name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( style, origName ) );

        // gets hook for the prefixed version
        // followed by the unprefixed version
        hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

        // Check if we're setting a value
        if ( value !== undefined ) {
            type = typeof value;

            // convert relative number strings (+= or -=) to relative numbers. #7345
            if ( type === "string" && (ret = rrelNum.exec( value )) ) {
                value = ( ret[1] + 1 ) * ret[2] + parseFloat( jQuery.css( elem, name ) );
                // Fixes bug #9237
                type = "number";
            }

            // Make sure that NaN and null values aren't set. See: #7116
            if ( value == null || type === "number" && isNaN( value ) ) {
                return;
            }

            // If a number was passed in, add 'px' to the (except for certain CSS properties)
            if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
                value += "px";
            }

            // If a hook was provided, use that value, otherwise just set the specified value
            if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value, extra )) !== undefined ) {
                // Wrapped to prevent IE from throwing errors when 'invalid' values are provided
                // Fixes bug #5509
                try {
                    style[ name ] = value;
                } catch(e) {}
            }

        } else {
            // If a hook was provided get the non-computed value from there
            if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
                return ret;
            }

            // Otherwise just get the value from the style object
            return style[ name ];
        }
    },

    css: function( elem, name, numeric, extra ) {
        var val, num, hooks,
            origName = jQuery.camelCase( name );

        // Make sure that we're working with the right name
        name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( elem.style, origName ) );

        // gets hook for the prefixed version
        // followed by the unprefixed version
        hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

        // If a hook was provided get the computed value from there
        if ( hooks && "get" in hooks ) {
            val = hooks.get( elem, true, extra );
        }

        // Otherwise, if a way to get the computed value exists, use that
        if ( val === undefined ) {
            val = curCSS( elem, name );
        }

        //convert "normal" to computed value
        if ( val === "normal" && name in cssNormalTransform ) {
            val = cssNormalTransform[ name ];
        }

        // Return, converting to number if forced or a qualifier was provided and val looks numeric
        if ( numeric || extra !== undefined ) {
            num = parseFloat( val );
            return numeric || jQuery.isNumeric( num ) ? num || 0 : val;
        }
        return val;
    },

    // A method for quickly swapping in/out CSS properties to get correct calculations
    swap: function( elem, options, callback ) {
        var ret, name,
            old = {};

        // Remember the old values, and insert the new ones
        for ( name in options ) {
            old[ name ] = elem.style[ name ];
            elem.style[ name ] = options[ name ];
        }

        ret = callback.call( elem );

        // Revert the old values
        for ( name in options ) {
            elem.style[ name ] = old[ name ];
        }

        return ret;
    }
});

// NOTE: To any future maintainer, we've window.getComputedStyle
// because jsdom on node.js will break without it.
if ( window.getComputedStyle ) {
    curCSS = function( elem, name ) {
        var ret, width, minWidth, maxWidth,
            computed = window.getComputedStyle( elem, null ),
            style = elem.style;

        if ( computed ) {

            // getPropertyValue is only needed for .css('filter') in IE9, see #12537
            ret = computed.getPropertyValue( name ) || computed[ name ];

            if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
                ret = jQuery.style( elem, name );
            }

            // A tribute to the "awesome hack by Dean Edwards"
            // Chrome < 17 and Safari 5.0 uses "computed value" instead of "used value" for margin-right
            // Safari 5.1.7 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
            // this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
            if ( rnumnonpx.test( ret ) && rmargin.test( name ) ) {
                width = style.width;
                minWidth = style.minWidth;
                maxWidth = style.maxWidth;

                style.minWidth = style.maxWidth = style.width = ret;
                ret = computed.width;

                style.width = width;
                style.minWidth = minWidth;
                style.maxWidth = maxWidth;
            }
        }

        return ret;
    };
} else if ( document.documentElement.currentStyle ) {
    curCSS = function( elem, name ) {
        var left, rsLeft,
            ret = elem.currentStyle && elem.currentStyle[ name ],
            style = elem.style;

        // Avoid setting ret to empty string here
        // so we don't default to auto
        if ( ret == null && style && style[ name ] ) {
            ret = style[ name ];
        }

        // From the awesome hack by Dean Edwards
        // http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

        // If we're not dealing with a regular pixel number
        // but a number that has a weird ending, we need to convert it to pixels
        // but not position css attributes, as those are proportional to the parent element instead
        // and we can't measure the parent instead because it might trigger a "stacking dolls" problem
        if ( rnumnonpx.test( ret ) && !rposition.test( name ) ) {

            // Remember the original values
            left = style.left;
            rsLeft = elem.runtimeStyle && elem.runtimeStyle.left;

            // Put in the new values to get a computed value out
            if ( rsLeft ) {
                elem.runtimeStyle.left = elem.currentStyle.left;
            }
            style.left = name === "fontSize" ? "1em" : ret;
            ret = style.pixelLeft + "px";

            // Revert the changed values
            style.left = left;
            if ( rsLeft ) {
                elem.runtimeStyle.left = rsLeft;
            }
        }

        return ret === "" ? "auto" : ret;
    };
}

function setPositiveNumber( elem, value, subtract ) {
    var matches = rnumsplit.exec( value );
    return matches ?
            Math.max( 0, matches[ 1 ] - ( subtract || 0 ) ) + ( matches[ 2 ] || "px" ) :
            value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox ) {
    var i = extra === ( isBorderBox ? "border" : "content" ) ?
        // If we already have the right measurement, avoid augmentation
        4 :
        // Otherwise initialize for horizontal or vertical properties
        name === "width" ? 1 : 0,

        val = 0;

    for ( ; i < 4; i += 2 ) {
        // both box models exclude margin, so add it if we want it
        if ( extra === "margin" ) {
            // we use jQuery.css instead of curCSS here
            // because of the reliableMarginRight CSS hook!
            val += jQuery.css( elem, extra + cssExpand[ i ], true );
        }

        // From this point on we use curCSS for maximum performance (relevant in animations)
        if ( isBorderBox ) {
            // border-box includes padding, so remove it if we want content
            if ( extra === "content" ) {
                val -= parseFloat( curCSS( elem, "padding" + cssExpand[ i ] ) ) || 0;
            }

            // at this point, extra isn't border nor margin, so remove border
            if ( extra !== "margin" ) {
                val -= parseFloat( curCSS( elem, "border" + cssExpand[ i ] + "Width" ) ) || 0;
            }
        } else {
            // at this point, extra isn't content, so add padding
            val += parseFloat( curCSS( elem, "padding" + cssExpand[ i ] ) ) || 0;

            // at this point, extra isn't content nor padding, so add border
            if ( extra !== "padding" ) {
                val += parseFloat( curCSS( elem, "border" + cssExpand[ i ] + "Width" ) ) || 0;
            }
        }
    }

    return val;
}

function getWidthOrHeight( elem, name, extra ) {

    // Start with offset property, which is equivalent to the border-box value
    var val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
        valueIsBorderBox = true,
        isBorderBox = jQuery.support.boxSizing && jQuery.css( elem, "boxSizing" ) === "border-box";

    // some non-html elements return undefined for offsetWidth, so check for null/undefined
    // svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
    // MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
    if ( val <= 0 || val == null ) {
        // Fall back to computed then uncomputed css if necessary
        val = curCSS( elem, name );
        if ( val < 0 || val == null ) {
            val = elem.style[ name ];
        }

        // Computed unit is not pixels. Stop here and return.
        if ( rnumnonpx.test(val) ) {
            return val;
        }

        // we need the check for style in case a browser which returns unreliable values
        // for getComputedStyle silently falls back to the reliable elem.style
        valueIsBorderBox = isBorderBox && ( jQuery.support.boxSizingReliable || val === elem.style[ name ] );

        // Normalize "", auto, and prepare for extra
        val = parseFloat( val ) || 0;
    }

    // use the active box-sizing model to add/subtract irrelevant styles
    return ( val +
        augmentWidthOrHeight(
            elem,
            name,
            extra || ( isBorderBox ? "border" : "content" ),
            valueIsBorderBox
        )
    ) + "px";
}


// Try to determine the default display value of an element
function css_defaultDisplay( nodeName ) {
    if ( elemdisplay[ nodeName ] ) {
        return elemdisplay[ nodeName ];
    }

    var elem = jQuery( "<" + nodeName + ">" ).appendTo( document.body ),
        display = elem.css("display");
    elem.remove();

    // If the simple way fails,
    // get element's real default display by attaching it to a temp iframe
    if ( display === "none" || display === "" ) {
        // Use the already-created iframe if possible
        iframe = document.body.appendChild(
            iframe || jQuery.extend( document.createElement("iframe"), {
                frameBorder: 0,
                width: 0,
                height: 0
            })
        );

        // Create a cacheable copy of the iframe document on first call.
        // IE and Opera will allow us to reuse the iframeDoc without re-writing the fake HTML
        // document to it; WebKit & Firefox won't allow reusing the iframe document.
        if ( !iframeDoc || !iframe.createElement ) {
            iframeDoc = ( iframe.contentWindow || iframe.contentDocument ).document;
            iframeDoc.write("<!doctype html><html><body>");
            iframeDoc.close();
        }

        elem = iframeDoc.body.appendChild( iframeDoc.createElement(nodeName) );

        display = curCSS( elem, "display" );
        document.body.removeChild( iframe );
    }

    // Store the correct default display
    elemdisplay[ nodeName ] = display;

    return display;
}

jQuery.each([ "height", "width" ], function( i, name ) {
    jQuery.cssHooks[ name ] = {
        get: function( elem, computed, extra ) {
            if ( computed ) {
                // certain elements can have dimension info if we invisibly show them
                // however, it must have a current display style that would benefit from this
                if ( elem.offsetWidth === 0 && rdisplayswap.test( curCSS( elem, "display" ) ) ) {
                    return jQuery.swap( elem, cssShow, function() {
                        return getWidthOrHeight( elem, name, extra );
                    });
                } else {
                    return getWidthOrHeight( elem, name, extra );
                }
            }
        },

        set: function( elem, value, extra ) {
            return setPositiveNumber( elem, value, extra ?
                augmentWidthOrHeight(
                    elem,
                    name,
                    extra,
                    jQuery.support.boxSizing && jQuery.css( elem, "boxSizing" ) === "border-box"
                ) : 0
            );
        }
    };
});

if ( !jQuery.support.opacity ) {
    jQuery.cssHooks.opacity = {
        get: function( elem, computed ) {
            // IE uses filters for opacity
            return ropacity.test( (computed && elem.currentStyle ? elem.currentStyle.filter : elem.style.filter) || "" ) ?
                ( 0.01 * parseFloat( RegExp.$1 ) ) + "" :
                computed ? "1" : "";
        },

        set: function( elem, value ) {
            var style = elem.style,
                currentStyle = elem.currentStyle,
                opacity = jQuery.isNumeric( value ) ? "alpha(opacity=" + value * 100 + ")" : "",
                filter = currentStyle && currentStyle.filter || style.filter || "";

            // IE has trouble with opacity if it does not have layout
            // Force it by setting the zoom level
            style.zoom = 1;

            // if setting opacity to 1, and no other filters exist - attempt to remove filter attribute #6652
            if ( value >= 1 && jQuery.trim( filter.replace( ralpha, "" ) ) === "" &&
                style.removeAttribute ) {

                // Setting style.filter to null, "" & " " still leave "filter:" in the cssText
                // if "filter:" is present at all, clearType is disabled, we want to avoid this
                // style.removeAttribute is IE Only, but so apparently is this code path...
                style.removeAttribute( "filter" );

                // if there there is no filter style applied in a css rule, we are done
                if ( currentStyle && !currentStyle.filter ) {
                    return;
                }
            }

            // otherwise, set new filter values
            style.filter = ralpha.test( filter ) ?
                filter.replace( ralpha, opacity ) :
                filter + " " + opacity;
        }
    };
}

// These hooks cannot be added until DOM ready because the support test
// for it is not run until after DOM ready
jQuery(function() {
    if ( !jQuery.support.reliableMarginRight ) {
        jQuery.cssHooks.marginRight = {
            get: function( elem, computed ) {
                // WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
                // Work around by temporarily setting element display to inline-block
                return jQuery.swap( elem, { "display": "inline-block" }, function() {
                    if ( computed ) {
                        return curCSS( elem, "marginRight" );
                    }
                });
            }
        };
    }

    // Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
    // getComputedStyle returns percent when specified for top/left/bottom/right
    // rather than make the css module depend on the offset module, we just check for it here
    if ( !jQuery.support.pixelPosition && jQuery.fn.position ) {
        jQuery.each( [ "top", "left" ], function( i, prop ) {
            jQuery.cssHooks[ prop ] = {
                get: function( elem, computed ) {
                    if ( computed ) {
                        var ret = curCSS( elem, prop );
                        // if curCSS returns percentage, fallback to offset
                        return rnumnonpx.test( ret ) ? jQuery( elem ).position()[ prop ] + "px" : ret;
                    }
                }
            };
        });
    }

});

if ( jQuery.expr && jQuery.expr.filters ) {
    jQuery.expr.filters.hidden = function( elem ) {
        return ( elem.offsetWidth === 0 && elem.offsetHeight === 0 ) || (!jQuery.support.reliableHiddenOffsets && ((elem.style && elem.style.display) || curCSS( elem, "display" )) === "none");
    };

    jQuery.expr.filters.visible = function( elem ) {
        return !jQuery.expr.filters.hidden( elem );
    };
}

// These hooks are used by animate to expand properties
jQuery.each({
    margin: "",
    padding: "",
    border: "Width"
}, function( prefix, suffix ) {
    jQuery.cssHooks[ prefix + suffix ] = {
        expand: function( value ) {
            var i,

                // assumes a single number if not a string
                parts = typeof value === "string" ? value.split(" ") : [ value ],
                expanded = {};

            for ( i = 0; i < 4; i++ ) {
                expanded[ prefix + cssExpand[ i ] + suffix ] =
                    parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
            }

            return expanded;
        }
    };

    if ( !rmargin.test( prefix ) ) {
        jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
    }
});
var r20 = /%20/g,
    rbracket = /\[\]$/,
    rCRLF = /\r?\n/g,
    rinput = /^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,
    rselectTextarea = /^(?:select|textarea)/i;

jQuery.fn.extend({
    serialize: function() {
        return jQuery.param( this.serializeArray() );
    },
    serializeArray: function() {
        return this.map(function(){
            return this.elements ? jQuery.makeArray( this.elements ) : this;
        })
        .filter(function(){
            return this.name && !this.disabled &&
                ( this.checked || rselectTextarea.test( this.nodeName ) ||
                    rinput.test( this.type ) );
        })
        .map(function( i, elem ){
            var val = jQuery( this ).val();

            return val == null ?
                null :
                jQuery.isArray( val ) ?
                    jQuery.map( val, function( val, i ){
                        return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
                    }) :
                    { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
        }).get();
    }
});

//Serialize an array of form elements or a set of
//key/values into a query string
jQuery.param = function( a, traditional ) {
    var prefix,
        s = [],
        add = function( key, value ) {
            // If value is a function, invoke it and return its value
            value = jQuery.isFunction( value ) ? value() : ( value == null ? "" : value );
            s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
        };

    // Set traditional to true for jQuery <= 1.3.2 behavior.
    if ( traditional === undefined ) {
        traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
    }

    // If an array was passed in, assume that it is an array of form elements.
    if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
        // Serialize the form elements
        jQuery.each( a, function() {
            add( this.name, this.value );
        });

    } else {
        // If traditional, encode the "old" way (the way 1.3.2 or older
        // did it), otherwise encode params recursively.
        for ( prefix in a ) {
            buildParams( prefix, a[ prefix ], traditional, add );
        }
    }

    // Return the resulting serialization
    return s.join( "&" ).replace( r20, "+" );
};

function buildParams( prefix, obj, traditional, add ) {
    var name;

    if ( jQuery.isArray( obj ) ) {
        // Serialize array item.
        jQuery.each( obj, function( i, v ) {
            if ( traditional || rbracket.test( prefix ) ) {
                // Treat each array item as a scalar.
                add( prefix, v );

            } else {
                // If array item is non-scalar (array or object), encode its
                // numeric index to resolve deserialization ambiguity issues.
                // Note that rack (as of 1.0.0) can't currently deserialize
                // nested arrays properly, and attempting to do so may cause
                // a server error. Possible fixes are to modify rack's
                // deserialization algorithm or to provide an option or flag
                // to force array serialization to be shallow.
                buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
            }
        });

    } else if ( !traditional && jQuery.type( obj ) === "object" ) {
        // Serialize object item.
        for ( name in obj ) {
            buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
        }

    } else {
        // Serialize scalar item.
        add( prefix, obj );
    }
}
var
    // Document location
    ajaxLocParts,
    ajaxLocation,

    rhash = /#.*$/,
    rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, // IE leaves an \r character at EOL
    // #7653, #8125, #8152: local protocol detection
    rlocalProtocol = /^(?:about|app|app\-storage|.+\-extension|file|res|widget):$/,
    rnoContent = /^(?:GET|HEAD)$/,
    rprotocol = /^\/\//,
    rquery = /\?/,
    rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    rts = /([?&])_=[^&]*/,
    rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,

    // Keep a copy of the old load method
    _load = jQuery.fn.load,

    /* Prefilters
     * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
     * 2) These are called:
     *    - BEFORE asking for a transport
     *    - AFTER param serialization (s.data is a string if s.processData is true)
     * 3) key is the dataType
     * 4) the catchall symbol "*" can be used
     * 5) execution will start with transport dataType and THEN continue down to "*" if needed
     */
    prefilters = {},

    /* Transports bindings
     * 1) key is the dataType
     * 2) the catchall symbol "*" can be used
     * 3) selection will start with transport dataType and THEN go to "*" if needed
     */
    transports = {},

    // Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
    allTypes = ["*/"] + ["*"];

// #8138, IE may throw an exception when accessing
// a field from window.location if document.domain has been set
try {
    ajaxLocation = location.href;
} catch( e ) {
    // Use the href attribute of an A element
    // since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
}

// Segment location into parts
ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

    // dataTypeExpression is optional and defaults to "*"
    return function( dataTypeExpression, func ) {

        if ( typeof dataTypeExpression !== "string" ) {
            func = dataTypeExpression;
            dataTypeExpression = "*";
        }

        var dataType, list, placeBefore,
            dataTypes = dataTypeExpression.toLowerCase().split( core_rspace ),
            i = 0,
            length = dataTypes.length;

        if ( jQuery.isFunction( func ) ) {
            // For each dataType in the dataTypeExpression
            for ( ; i < length; i++ ) {
                dataType = dataTypes[ i ];
                // We control if we're asked to add before
                // any existing element
                placeBefore = /^\+/.test( dataType );
                if ( placeBefore ) {
                    dataType = dataType.substr( 1 ) || "*";
                }
                list = structure[ dataType ] = structure[ dataType ] || [];
                // then we add to the structure accordingly
                list[ placeBefore ? "unshift" : "push" ]( func );
            }
        }
    };
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR,
        dataType /* internal */, inspected /* internal */ ) {

    dataType = dataType || options.dataTypes[ 0 ];
    inspected = inspected || {};

    inspected[ dataType ] = true;

    var selection,
        list = structure[ dataType ],
        i = 0,
        length = list ? list.length : 0,
        executeOnly = ( structure === prefilters );

    for ( ; i < length && ( executeOnly || !selection ); i++ ) {
        selection = list[ i ]( options, originalOptions, jqXHR );
        // If we got redirected to another dataType
        // we try there if executing only and not done already
        if ( typeof selection === "string" ) {
            if ( !executeOnly || inspected[ selection ] ) {
                selection = undefined;
            } else {
                options.dataTypes.unshift( selection );
                selection = inspectPrefiltersOrTransports(
                        structure, options, originalOptions, jqXHR, selection, inspected );
            }
        }
    }
    // If we're only executing or nothing was selected
    // we try the catchall dataType if not done already
    if ( ( executeOnly || !selection ) && !inspected[ "*" ] ) {
        selection = inspectPrefiltersOrTransports(
                structure, options, originalOptions, jqXHR, "*", inspected );
    }
    // unnecessary when only executing (prefilters)
    // but it'll be ignored by the caller in that case
    return selection;
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
    var key, deep,
        flatOptions = jQuery.ajaxSettings.flatOptions || {};
    for ( key in src ) {
        if ( src[ key ] !== undefined ) {
            ( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
        }
    }
    if ( deep ) {
        jQuery.extend( true, target, deep );
    }
}

jQuery.fn.load = function( url, params, callback ) {
    if ( typeof url !== "string" && _load ) {
        return _load.apply( this, arguments );
    }

    // Don't do a request if no elements are being requested
    if ( !this.length ) {
        return this;
    }

    var selector, type, response,
        self = this,
        off = url.indexOf(" ");

    if ( off >= 0 ) {
        selector = url.slice( off, url.length );
        url = url.slice( 0, off );
    }

    // If it's a function
    if ( jQuery.isFunction( params ) ) {

        // We assume that it's the callback
        callback = params;
        params = undefined;

    // Otherwise, build a param string
    } else if ( params && typeof params === "object" ) {
        type = "POST";
    }

    // Request the remote document
    jQuery.ajax({
        url: url,

        // if "type" variable is undefined, then "GET" method will be used
        type: type,
        dataType: "html",
        data: params,
        complete: function( jqXHR, status ) {
            if ( callback ) {
                self.each( callback, response || [ jqXHR.responseText, status, jqXHR ] );
            }
        }
    }).done(function( responseText ) {

        // Save response for use in complete callback
        response = arguments;

        // See if a selector was specified
        self.html( selector ?

            // Create a dummy div to hold the results
            jQuery("<div>")

                // inject the contents of the document in, removing the scripts
                // to avoid any 'Permission Denied' errors in IE
                .append( responseText.replace( rscript, "" ) )

                // Locate the specified elements
                .find( selector ) :

            // If not, just inject the full result
            responseText );

    });

    return this;
};

// Attach a bunch of functions for handling common AJAX events
jQuery.each( "ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split( " " ), function( i, o ){
    jQuery.fn[ o ] = function( f ){
        return this.on( o, f );
    };
});

jQuery.each( [ "get", "post" ], function( i, method ) {
    jQuery[ method ] = function( url, data, callback, type ) {
        // shift arguments if data argument was omitted
        if ( jQuery.isFunction( data ) ) {
            type = type || callback;
            callback = data;
            data = undefined;
        }

        return jQuery.ajax({
            type: method,
            url: url,
            data: data,
            success: callback,
            dataType: type
        });
    };
});

jQuery.extend({

    getScript: function( url, callback ) {
        return jQuery.get( url, undefined, callback, "script" );
    },

    getJSON: function( url, data, callback ) {
        return jQuery.get( url, data, callback, "json" );
    },

    // Creates a full fledged settings object into target
    // with both ajaxSettings and settings fields.
    // If target is omitted, writes into ajaxSettings.
    ajaxSetup: function( target, settings ) {
        if ( settings ) {
            // Building a settings object
            ajaxExtend( target, jQuery.ajaxSettings );
        } else {
            // Extending ajaxSettings
            settings = target;
            target = jQuery.ajaxSettings;
        }
        ajaxExtend( target, settings );
        return target;
    },

    ajaxSettings: {
        url: ajaxLocation,
        isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
        global: true,
        type: "GET",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        processData: true,
        async: true,
        /*
        timeout: 0,
        data: null,
        dataType: null,
        username: null,
        password: null,
        cache: null,
        throws: false,
        traditional: false,
        headers: {},
        */

        accepts: {
            xml: "application/xml, text/xml",
            html: "text/html",
            text: "text/plain",
            json: "application/json, text/javascript",
            "*": allTypes
        },

        contents: {
            xml: /xml/,
            html: /html/,
            json: /json/
        },

        responseFields: {
            xml: "responseXML",
            text: "responseText"
        },

        // List of data converters
        // 1) key format is "source_type destination_type" (a single space in-between)
        // 2) the catchall symbol "*" can be used for source_type
        converters: {

            // Convert anything to text
            "* text": window.String,

            // Text to html (true = no transformation)
            "text html": true,

            // Evaluate text as a json expression
            "text json": jQuery.parseJSON,

            // Parse text as xml
            "text xml": jQuery.parseXML
        },

        // For options that shouldn't be deep extended:
        // you can add your own custom options here if
        // and when you create one that shouldn't be
        // deep extended (see ajaxExtend)
        flatOptions: {
            context: true,
            url: true
        }
    },

    ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
    ajaxTransport: addToPrefiltersOrTransports( transports ),

    // Main method
    ajax: function( url, options ) {

        // If url is an object, simulate pre-1.5 signature
        if ( typeof url === "object" ) {
            options = url;
            url = undefined;
        }

        // Force options to be an object
        options = options || {};

        var // ifModified key
            ifModifiedKey,
            // Response headers
            responseHeadersString,
            responseHeaders,
            // transport
            transport,
            // timeout handle
            timeoutTimer,
            // Cross-domain detection vars
            parts,
            // To know if global events are to be dispatched
            fireGlobals,
            // Loop variable
            i,
            // Create the final options object
            s = jQuery.ajaxSetup( {}, options ),
            // Callbacks context
            callbackContext = s.context || s,
            // Context for global events
            // It's the callbackContext if one was provided in the options
            // and if it's a DOM node or a jQuery collection
            globalEventContext = callbackContext !== s &&
                ( callbackContext.nodeType || callbackContext instanceof jQuery ) ?
                        jQuery( callbackContext ) : jQuery.event,
            // Deferreds
            deferred = jQuery.Deferred(),
            completeDeferred = jQuery.Callbacks( "once memory" ),
            // Status-dependent callbacks
            statusCode = s.statusCode || {},
            // Headers (they are sent all at once)
            requestHeaders = {},
            requestHeadersNames = {},
            // The jqXHR state
            state = 0,
            // Default abort message
            strAbort = "canceled",
            // Fake xhr
            jqXHR = {

                readyState: 0,

                // Caches the header
                setRequestHeader: function( name, value ) {
                    if ( !state ) {
                        var lname = name.toLowerCase();
                        name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
                        requestHeaders[ name ] = value;
                    }
                    return this;
                },

                // Raw string
                getAllResponseHeaders: function() {
                    return state === 2 ? responseHeadersString : null;
                },

                // Builds headers hashtable if needed
                getResponseHeader: function( key ) {
                    var match;
                    if ( state === 2 ) {
                        if ( !responseHeaders ) {
                            responseHeaders = {};
                            while( ( match = rheaders.exec( responseHeadersString ) ) ) {
                                responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
                            }
                        }
                        match = responseHeaders[ key.toLowerCase() ];
                    }
                    return match === undefined ? null : match;
                },

                // Overrides response content-type header
                overrideMimeType: function( type ) {
                    if ( !state ) {
                        s.mimeType = type;
                    }
                    return this;
                },

                // Cancel the request
                abort: function( statusText ) {
                    statusText = statusText || strAbort;
                    if ( transport ) {
                        transport.abort( statusText );
                    }
                    done( 0, statusText );
                    return this;
                }
            };

        // Callback for when everything is done
        // It is defined here because jslint complains if it is declared
        // at the end of the function (which would be more logical and readable)
        function done( status, nativeStatusText, responses, headers ) {
            var isSuccess, success, error, response, modified,
                statusText = nativeStatusText;

            // Called once
            if ( state === 2 ) {
                return;
            }

            // State is "done" now
            state = 2;

            // Clear timeout if it exists
            if ( timeoutTimer ) {
                clearTimeout( timeoutTimer );
            }

            // Dereference transport for early garbage collection
            // (no matter how long the jqXHR object will be used)
            transport = undefined;

            // Cache response headers
            responseHeadersString = headers || "";

            // Set readyState
            jqXHR.readyState = status > 0 ? 4 : 0;

            // Get response data
            if ( responses ) {
                response = ajaxHandleResponses( s, jqXHR, responses );
            }

            // If successful, handle type chaining
            if ( status >= 200 && status < 300 || status === 304 ) {

                // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
                if ( s.ifModified ) {

                    modified = jqXHR.getResponseHeader("Last-Modified");
                    if ( modified ) {
                        jQuery.lastModified[ ifModifiedKey ] = modified;
                    }
                    modified = jqXHR.getResponseHeader("Etag");
                    if ( modified ) {
                        jQuery.etag[ ifModifiedKey ] = modified;
                    }
                }

                // If not modified
                if ( status === 304 ) {

                    statusText = "notmodified";
                    isSuccess = true;

                // If we have data
                } else {

                    isSuccess = ajaxConvert( s, response );
                    statusText = isSuccess.state;
                    success = isSuccess.data;
                    error = isSuccess.error;
                    isSuccess = !error;
                }
            } else {
                // We extract error from statusText
                // then normalize statusText and status for non-aborts
                error = statusText;
                if ( !statusText || status ) {
                    statusText = "error";
                    if ( status < 0 ) {
                        status = 0;
                    }
                }
            }

            // Set data for the fake xhr object
            jqXHR.status = status;
            jqXHR.statusText = ( nativeStatusText || statusText ) + "";

            // Success/Error
            if ( isSuccess ) {
                deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
            } else {
                deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
            }

            // Status-dependent callbacks
            jqXHR.statusCode( statusCode );
            statusCode = undefined;

            if ( fireGlobals ) {
                globalEventContext.trigger( "ajax" + ( isSuccess ? "Success" : "Error" ),
                        [ jqXHR, s, isSuccess ? success : error ] );
            }

            // Complete
            completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

            if ( fireGlobals ) {
                globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
                // Handle the global AJAX counter
                if ( !( --jQuery.active ) ) {
                    jQuery.event.trigger( "ajaxStop" );
                }
            }
        }

        // Attach deferreds
        deferred.promise( jqXHR );
        jqXHR.success = jqXHR.done;
        jqXHR.error = jqXHR.fail;
        jqXHR.complete = completeDeferred.add;

        // Status-dependent callbacks
        jqXHR.statusCode = function( map ) {
            if ( map ) {
                var tmp;
                if ( state < 2 ) {
                    for ( tmp in map ) {
                        statusCode[ tmp ] = [ statusCode[tmp], map[tmp] ];
                    }
                } else {
                    tmp = map[ jqXHR.status ];
                    jqXHR.always( tmp );
                }
            }
            return this;
        };

        // Remove hash character (#7531: and string promotion)
        // Add protocol if not provided (#5866: IE7 issue with protocol-less urls)
        // We also use the url parameter if available
        s.url = ( ( url || s.url ) + "" ).replace( rhash, "" ).replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

        // Extract dataTypes list
        s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().split( core_rspace );

        // A cross-domain request is in order when we have a protocol:host:port mismatch
        if ( s.crossDomain == null ) {
            parts = rurl.exec( s.url.toLowerCase() );
            s.crossDomain = !!( parts &&
                ( parts[ 1 ] !== ajaxLocParts[ 1 ] || parts[ 2 ] !== ajaxLocParts[ 2 ] ||
                    ( parts[ 3 ] || ( parts[ 1 ] === "http:" ? 80 : 443 ) ) !=
                        ( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? 80 : 443 ) ) )
            );
        }

        // Convert data if not already a string
        if ( s.data && s.processData && typeof s.data !== "string" ) {
            s.data = jQuery.param( s.data, s.traditional );
        }

        // Apply prefilters
        inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

        // If request was aborted inside a prefilter, stop there
        if ( state === 2 ) {
            return jqXHR;
        }

        // We can fire global events as of now if asked to
        fireGlobals = s.global;

        // Uppercase the type
        s.type = s.type.toUpperCase();

        // Determine if request has content
        s.hasContent = !rnoContent.test( s.type );

        // Watch for a new set of requests
        if ( fireGlobals && jQuery.active++ === 0 ) {
            jQuery.event.trigger( "ajaxStart" );
        }

        // More options handling for requests with no content
        if ( !s.hasContent ) {

            // If data is available, append data to url
            if ( s.data ) {
                s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.data;
                // #9682: remove data so that it's not used in an eventual retry
                delete s.data;
            }

            // Get ifModifiedKey before adding the anti-cache parameter
            ifModifiedKey = s.url;

            // Add anti-cache in url if needed
            if ( s.cache === false ) {

                var ts = jQuery.now(),
                    // try replacing _= if it is there
                    ret = s.url.replace( rts, "$1_=" + ts );

                // if nothing was replaced, add timestamp to the end
                s.url = ret + ( ( ret === s.url ) ? ( rquery.test( s.url ) ? "&" : "?" ) + "_=" + ts : "" );
            }
        }

        // Set the correct header, if data is being sent
        if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
            jqXHR.setRequestHeader( "Content-Type", s.contentType );
        }

        // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
        if ( s.ifModified ) {
            ifModifiedKey = ifModifiedKey || s.url;
            if ( jQuery.lastModified[ ifModifiedKey ] ) {
                jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ ifModifiedKey ] );
            }
            if ( jQuery.etag[ ifModifiedKey ] ) {
                jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ ifModifiedKey ] );
            }
        }

        // Set the Accepts header for the server, depending on the dataType
        jqXHR.setRequestHeader(
            "Accept",
            s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
                s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
                s.accepts[ "*" ]
        );

        // Check for headers option
        for ( i in s.headers ) {
            jqXHR.setRequestHeader( i, s.headers[ i ] );
        }

        // Allow custom headers/mimetypes and early abort
        if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
                // Abort if not done already and return
                return jqXHR.abort();

        }

        // aborting is no longer a cancellation
        strAbort = "abort";

        // Install callbacks on deferreds
        for ( i in { success: 1, error: 1, complete: 1 } ) {
            jqXHR[ i ]( s[ i ] );
        }

        // Get transport
        transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

        // If no transport, we auto-abort
        if ( !transport ) {
            done( -1, "No Transport" );
        } else {
            jqXHR.readyState = 1;
            // Send global event
            if ( fireGlobals ) {
                globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
            }
            // Timeout
            if ( s.async && s.timeout > 0 ) {
                timeoutTimer = setTimeout( function(){
                    jqXHR.abort( "timeout" );
                }, s.timeout );
            }

            try {
                state = 1;
                transport.send( requestHeaders, done );
            } catch (e) {
                // Propagate exception as error if not done
                if ( state < 2 ) {
                    done( -1, e );
                // Simply rethrow otherwise
                } else {
                    throw e;
                }
            }
        }

        return jqXHR;
    },

    // Counter for holding the number of active queries
    active: 0,

    // Last-Modified header cache for next request
    lastModified: {},
    etag: {}

});

/* Handles responses to an ajax request:
 * - sets all responseXXX fields accordingly
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

    var ct, type, finalDataType, firstDataType,
        contents = s.contents,
        dataTypes = s.dataTypes,
        responseFields = s.responseFields;

    // Fill responseXXX fields
    for ( type in responseFields ) {
        if ( type in responses ) {
            jqXHR[ responseFields[type] ] = responses[ type ];
        }
    }

    // Remove auto dataType and get content-type in the process
    while( dataTypes[ 0 ] === "*" ) {
        dataTypes.shift();
        if ( ct === undefined ) {
            ct = s.mimeType || jqXHR.getResponseHeader( "content-type" );
        }
    }

    // Check if we're dealing with a known content-type
    if ( ct ) {
        for ( type in contents ) {
            if ( contents[ type ] && contents[ type ].test( ct ) ) {
                dataTypes.unshift( type );
                break;
            }
        }
    }

    // Check to see if we have a response for the expected dataType
    if ( dataTypes[ 0 ] in responses ) {
        finalDataType = dataTypes[ 0 ];
    } else {
        // Try convertible dataTypes
        for ( type in responses ) {
            if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
                finalDataType = type;
                break;
            }
            if ( !firstDataType ) {
                firstDataType = type;
            }
        }
        // Or just use first one
        finalDataType = finalDataType || firstDataType;
    }

    // If we found a dataType
    // We add the dataType to the list if needed
    // and return the corresponding response
    if ( finalDataType ) {
        if ( finalDataType !== dataTypes[ 0 ] ) {
            dataTypes.unshift( finalDataType );
        }
        return responses[ finalDataType ];
    }
}

// Chain conversions given the request and the original response
function ajaxConvert( s, response ) {

    var conv, conv2, current, tmp,
        // Work with a copy of dataTypes in case we need to modify it for conversion
        dataTypes = s.dataTypes.slice(),
        prev = dataTypes[ 0 ],
        converters = {},
        i = 0;

    // Apply the dataFilter if provided
    if ( s.dataFilter ) {
        response = s.dataFilter( response, s.dataType );
    }

    // Create converters map with lowercased keys
    if ( dataTypes[ 1 ] ) {
        for ( conv in s.converters ) {
            converters[ conv.toLowerCase() ] = s.converters[ conv ];
        }
    }

    // Convert to each sequential dataType, tolerating list modification
    for ( ; (current = dataTypes[++i]); ) {

        // There's only work to do if current dataType is non-auto
        if ( current !== "*" ) {

            // Convert response if prev dataType is non-auto and differs from current
            if ( prev !== "*" && prev !== current ) {

                // Seek a direct converter
                conv = converters[ prev + " " + current ] || converters[ "* " + current ];

                // If none found, seek a pair
                if ( !conv ) {
                    for ( conv2 in converters ) {

                        // If conv2 outputs current
                        tmp = conv2.split(" ");
                        if ( tmp[ 1 ] === current ) {

                            // If prev can be converted to accepted input
                            conv = converters[ prev + " " + tmp[ 0 ] ] ||
                                converters[ "* " + tmp[ 0 ] ];
                            if ( conv ) {
                                // Condense equivalence converters
                                if ( conv === true ) {
                                    conv = converters[ conv2 ];

                                // Otherwise, insert the intermediate dataType
                                } else if ( converters[ conv2 ] !== true ) {
                                    current = tmp[ 0 ];
                                    dataTypes.splice( i--, 0, current );
                                }

                                break;
                            }
                        }
                    }
                }

                // Apply converter (if not an equivalence)
                if ( conv !== true ) {

                    // Unless errors are allowed to bubble, catch and return them
                    if ( conv && s["throws"] ) {
                        response = conv( response );
                    } else {
                        try {
                            response = conv( response );
                        } catch ( e ) {
                            return { state: "parsererror", error: conv ? e : "No conversion from " + prev + " to " + current };
                        }
                    }
                }
            }

            // Update prev for next iteration
            prev = current;
        }
    }

    return { state: "success", data: response };
}
var oldCallbacks = [],
    rquestion = /\?/,
    rjsonp = /(=)\?(?=&|$)|\?\?/,
    nonce = jQuery.now();

// Default jsonp settings
jQuery.ajaxSetup({
    jsonp: "callback",
    jsonpCallback: function() {
        var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
        this[ callback ] = true;
        return callback;
    }
});

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

    var callbackName, overwritten, responseContainer,
        data = s.data,
        url = s.url,
        hasCallback = s.jsonp !== false,
        replaceInUrl = hasCallback && rjsonp.test( url ),
        replaceInData = hasCallback && !replaceInUrl && typeof data === "string" &&
            !( s.contentType || "" ).indexOf("application/x-www-form-urlencoded") &&
            rjsonp.test( data );

    // Handle iff the expected data type is "jsonp" or we have a parameter to set
    if ( s.dataTypes[ 0 ] === "jsonp" || replaceInUrl || replaceInData ) {

        // Get callback name, remembering preexisting value associated with it
        callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
            s.jsonpCallback() :
            s.jsonpCallback;
        overwritten = window[ callbackName ];

        // Insert callback into url or form data
        if ( replaceInUrl ) {
            s.url = url.replace( rjsonp, "$1" + callbackName );
        } else if ( replaceInData ) {
            s.data = data.replace( rjsonp, "$1" + callbackName );
        } else if ( hasCallback ) {
            s.url += ( rquestion.test( url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
        }

        // Use data converter to retrieve json after script execution
        s.converters["script json"] = function() {
            if ( !responseContainer ) {
                jQuery.error( callbackName + " was not called" );
            }
            return responseContainer[ 0 ];
        };

        // force json dataType
        s.dataTypes[ 0 ] = "json";

        // Install callback
        window[ callbackName ] = function() {
            responseContainer = arguments;
        };

        // Clean-up function (fires after converters)
        jqXHR.always(function() {
            // Restore preexisting value
            window[ callbackName ] = overwritten;

            // Save back as free
            if ( s[ callbackName ] ) {
                // make sure that re-using the options doesn't screw things around
                s.jsonpCallback = originalSettings.jsonpCallback;

                // save the callback name for future use
                oldCallbacks.push( callbackName );
            }

            // Call if it was a function and we have a response
            if ( responseContainer && jQuery.isFunction( overwritten ) ) {
                overwritten( responseContainer[ 0 ] );
            }

            responseContainer = overwritten = undefined;
        });

        // Delegate to script
        return "script";
    }
});
// Install script dataType
jQuery.ajaxSetup({
    accepts: {
        script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
    },
    contents: {
        script: /javascript|ecmascript/
    },
    converters: {
        "text script": function( text ) {
            jQuery.globalEval( text );
            return text;
        }
    }
});

// Handle cache's special case and global
jQuery.ajaxPrefilter( "script", function( s ) {
    if ( s.cache === undefined ) {
        s.cache = false;
    }
    if ( s.crossDomain ) {
        s.type = "GET";
        s.global = false;
    }
});

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function(s) {

    // This transport only deals with cross domain requests
    if ( s.crossDomain ) {

        var script,
            head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;

        return {

            send: function( _, callback ) {

                script = document.createElement( "script" );

                script.async = "async";

                if ( s.scriptCharset ) {
                    script.charset = s.scriptCharset;
                }

                script.src = s.url;

                // Attach handlers for all browsers
                script.onload = script.onreadystatechange = function( _, isAbort ) {

                    if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {

                        // Handle memory leak in IE
                        script.onload = script.onreadystatechange = null;

                        // Remove the script
                        if ( head && script.parentNode ) {
                            head.removeChild( script );
                        }

                        // Dereference the script
                        script = undefined;

                        // Callback if not abort
                        if ( !isAbort ) {
                            callback( 200, "success" );
                        }
                    }
                };
                // Use insertBefore instead of appendChild  to circumvent an IE6 bug.
                // This arises when a base node is used (#2709 and #4378).
                head.insertBefore( script, head.firstChild );
            },

            abort: function() {
                if ( script ) {
                    script.onload( 0, 1 );
                }
            }
        };
    }
});
var xhrCallbacks,
    // #5280: Internet Explorer will keep connections alive if we don't abort on unload
    xhrOnUnloadAbort = window.ActiveXObject ? function() {
        // Abort all pending requests
        for ( var key in xhrCallbacks ) {
            xhrCallbacks[ key ]( 0, 1 );
        }
    } : false,
    xhrId = 0;

// Functions to create xhrs
function createStandardXHR() {
    try {
        return new window.XMLHttpRequest();
    } catch( e ) {}
}

function createActiveXHR() {
    try {
        return new window.ActiveXObject( "Microsoft.XMLHTTP" );
    } catch( e ) {}
}

// Create the request object
// (This is still attached to ajaxSettings for backward compatibility)
jQuery.ajaxSettings.xhr = window.ActiveXObject ?
    /* Microsoft failed to properly
     * implement the XMLHttpRequest in IE7 (can't request local files),
     * so we use the ActiveXObject when it is available
     * Additionally XMLHttpRequest can be disabled in IE7/IE8 so
     * we need a fallback.
     */
    function() {
        return !this.isLocal && createStandardXHR() || createActiveXHR();
    } :
    // For all other browsers, use the standard XMLHttpRequest object
    createStandardXHR;

// Determine support properties
(function( xhr ) {
    jQuery.extend( jQuery.support, {
        ajax: !!xhr,
        cors: !!xhr && ( "withCredentials" in xhr )
    });
})( jQuery.ajaxSettings.xhr() );

// Create transport if the browser can provide an xhr
if ( jQuery.support.ajax ) {

    jQuery.ajaxTransport(function( s ) {
        // Cross domain only allowed if supported through XMLHttpRequest
        if ( !s.crossDomain || jQuery.support.cors ) {

            var callback;

            return {
                send: function( headers, complete ) {

                    // Get a new xhr
                    var handle, i,
                        xhr = s.xhr();

                    // Open the socket
                    // Passing null username, generates a login popup on Opera (#2865)
                    if ( s.username ) {
                        xhr.open( s.type, s.url, s.async, s.username, s.password );
                    } else {
                        xhr.open( s.type, s.url, s.async );
                    }

                    // Apply custom fields if provided
                    if ( s.xhrFields ) {
                        for ( i in s.xhrFields ) {
                            xhr[ i ] = s.xhrFields[ i ];
                        }
                    }

                    // Override mime type if needed
                    if ( s.mimeType && xhr.overrideMimeType ) {
                        xhr.overrideMimeType( s.mimeType );
                    }

                    // X-Requested-With header
                    // For cross-domain requests, seeing as conditions for a preflight are
                    // akin to a jigsaw puzzle, we simply never set it to be sure.
                    // (it can always be set on a per-request basis or even using ajaxSetup)
                    // For same-domain requests, won't change header if already provided.
                    if ( !s.crossDomain && !headers["X-Requested-With"] ) {
                        headers[ "X-Requested-With" ] = "XMLHttpRequest";
                    }

                    // Need an extra try/catch for cross domain requests in Firefox 3
                    try {
                        for ( i in headers ) {
                            xhr.setRequestHeader( i, headers[ i ] );
                        }
                    } catch( _ ) {}

                    // Do send the request
                    // This may raise an exception which is actually
                    // handled in jQuery.ajax (so no try/catch here)
                    xhr.send( ( s.hasContent && s.data ) || null );

                    // Listener
                    callback = function( _, isAbort ) {

                        var status,
                            statusText,
                            responseHeaders,
                            responses,
                            xml;

                        // Firefox throws exceptions when accessing properties
                        // of an xhr when a network error occurred
                        // http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
                        try {

                            // Was never called and is aborted or complete
                            if ( callback && ( isAbort || xhr.readyState === 4 ) ) {

                                // Only called once
                                callback = undefined;

                                // Do not keep as active anymore
                                if ( handle ) {
                                    xhr.onreadystatechange = jQuery.noop;
                                    if ( xhrOnUnloadAbort ) {
                                        delete xhrCallbacks[ handle ];
                                    }
                                }

                                // If it's an abort
                                if ( isAbort ) {
                                    // Abort it manually if needed
                                    if ( xhr.readyState !== 4 ) {
                                        xhr.abort();
                                    }
                                } else {
                                    status = xhr.status;
                                    responseHeaders = xhr.getAllResponseHeaders();
                                    responses = {};
                                    xml = xhr.responseXML;

                                    // Construct response list
                                    if ( xml && xml.documentElement /* #4958 */ ) {
                                        responses.xml = xml;
                                    }

                                    // When requesting binary data, IE6-9 will throw an exception
                                    // on any attempt to access responseText (#11426)
                                    try {
                                        responses.text = xhr.responseText;
                                    } catch( e ) {
                                    }

                                    // Firefox throws an exception when accessing
                                    // statusText for faulty cross-domain requests
                                    try {
                                        statusText = xhr.statusText;
                                    } catch( e ) {
                                        // We normalize with Webkit giving an empty statusText
                                        statusText = "";
                                    }

                                    // Filter status for non standard behaviors

                                    // If the request is local and we have data: assume a success
                                    // (success with no data won't get notified, that's the best we
                                    // can do given current implementations)
                                    if ( !status && s.isLocal && !s.crossDomain ) {
                                        status = responses.text ? 200 : 404;
                                    // IE - #1450: sometimes returns 1223 when it should be 204
                                    } else if ( status === 1223 ) {
                                        status = 204;
                                    }
                                }
                            }
                        } catch( firefoxAccessException ) {
                            if ( !isAbort ) {
                                complete( -1, firefoxAccessException );
                            }
                        }

                        // Call complete if needed
                        if ( responses ) {
                            complete( status, statusText, responses, responseHeaders );
                        }
                    };

                    if ( !s.async ) {
                        // if we're in sync mode we fire the callback
                        callback();
                    } else if ( xhr.readyState === 4 ) {
                        // (IE6 & IE7) if it's in cache and has been
                        // retrieved directly we need to fire the callback
                        setTimeout( callback, 0 );
                    } else {
                        handle = ++xhrId;
                        if ( xhrOnUnloadAbort ) {
                            // Create the active xhrs callbacks list if needed
                            // and attach the unload handler
                            if ( !xhrCallbacks ) {
                                xhrCallbacks = {};
                                jQuery( window ).unload( xhrOnUnloadAbort );
                            }
                            // Add to list of active xhrs callbacks
                            xhrCallbacks[ handle ] = callback;
                        }
                        xhr.onreadystatechange = callback;
                    }
                },

                abort: function() {
                    if ( callback ) {
                        callback(0,1);
                    }
                }
            };
        }
    });
}
var fxNow, timerId,
    rfxtypes = /^(?:toggle|show|hide)$/,
    rfxnum = new RegExp( "^(?:([-+])=|)(" + core_pnum + ")([a-z%]*)$", "i" ),
    rrun = /queueHooks$/,
    animationPrefilters = [ defaultPrefilter ],
    tweeners = {
        "*": [function( prop, value ) {
            var end, unit,
                tween = this.createTween( prop, value ),
                parts = rfxnum.exec( value ),
                target = tween.cur(),
                start = +target || 0,
                scale = 1,
                maxIterations = 20;

            if ( parts ) {
                end = +parts[2];
                unit = parts[3] || ( jQuery.cssNumber[ prop ] ? "" : "px" );

                // We need to compute starting value
                if ( unit !== "px" && start ) {
                    // Iteratively approximate from a nonzero starting point
                    // Prefer the current property, because this process will be trivial if it uses the same units
                    // Fallback to end or a simple constant
                    start = jQuery.css( tween.elem, prop, true ) || end || 1;

                    do {
                        // If previous iteration zeroed out, double until we get *something*
                        // Use a string for doubling factor so we don't accidentally see scale as unchanged below
                        scale = scale || ".5";

                        // Adjust and apply
                        start = start / scale;
                        jQuery.style( tween.elem, prop, start + unit );

                    // Update scale, tolerating zero or NaN from tween.cur()
                    // And breaking the loop if scale is unchanged or perfect, or if we've just had enough
                    } while ( scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations );
                }

                tween.unit = unit;
                tween.start = start;
                // If a +=/-= token was provided, we're doing a relative animation
                tween.end = parts[1] ? start + ( parts[1] + 1 ) * end : end;
            }
            return tween;
        }]
    };

// Animations created synchronously will run synchronously
function createFxNow() {
    setTimeout(function() {
        fxNow = undefined;
    }, 0 );
    return ( fxNow = jQuery.now() );
}

function createTweens( animation, props ) {
    jQuery.each( props, function( prop, value ) {
        var collection = ( tweeners[ prop ] || [] ).concat( tweeners[ "*" ] ),
            index = 0,
            length = collection.length;
        for ( ; index < length; index++ ) {
            if ( collection[ index ].call( animation, prop, value ) ) {

                // we're done with this property
                return;
            }
        }
    });
}

function Animation( elem, properties, options ) {
    var result,
        index = 0,
        tweenerIndex = 0,
        length = animationPrefilters.length,
        deferred = jQuery.Deferred().always( function() {
            // don't match elem in the :animated selector
            delete tick.elem;
        }),
        tick = function() {
            var currentTime = fxNow || createFxNow(),
                remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),
                // archaic crash bug won't allow us to use 1 - ( 0.5 || 0 ) (#12497)
                temp = remaining / animation.duration || 0,
                percent = 1 - temp,
                index = 0,
                length = animation.tweens.length;

            for ( ; index < length ; index++ ) {
                animation.tweens[ index ].run( percent );
            }

            deferred.notifyWith( elem, [ animation, percent, remaining ]);

            if ( percent < 1 && length ) {
                return remaining;
            } else {
                deferred.resolveWith( elem, [ animation ] );
                return false;
            }
        },
        animation = deferred.promise({
            elem: elem,
            props: jQuery.extend( {}, properties ),
            opts: jQuery.extend( true, { specialEasing: {} }, options ),
            originalProperties: properties,
            originalOptions: options,
            startTime: fxNow || createFxNow(),
            duration: options.duration,
            tweens: [],
            createTween: function( prop, end, easing ) {
                var tween = jQuery.Tween( elem, animation.opts, prop, end,
                        animation.opts.specialEasing[ prop ] || animation.opts.easing );
                animation.tweens.push( tween );
                return tween;
            },
            stop: function( gotoEnd ) {
                var index = 0,
                    // if we are going to the end, we want to run all the tweens
                    // otherwise we skip this part
                    length = gotoEnd ? animation.tweens.length : 0;

                for ( ; index < length ; index++ ) {
                    animation.tweens[ index ].run( 1 );
                }

                // resolve when we played the last frame
                // otherwise, reject
                if ( gotoEnd ) {
                    deferred.resolveWith( elem, [ animation, gotoEnd ] );
                } else {
                    deferred.rejectWith( elem, [ animation, gotoEnd ] );
                }
                return this;
            }
        }),
        props = animation.props;

    propFilter( props, animation.opts.specialEasing );

    for ( ; index < length ; index++ ) {
        result = animationPrefilters[ index ].call( animation, elem, props, animation.opts );
        if ( result ) {
            return result;
        }
    }

    createTweens( animation, props );

    if ( jQuery.isFunction( animation.opts.start ) ) {
        animation.opts.start.call( elem, animation );
    }

    jQuery.fx.timer(
        jQuery.extend( tick, {
            anim: animation,
            queue: animation.opts.queue,
            elem: elem
        })
    );

    // attach callbacks from options
    return animation.progress( animation.opts.progress )
        .done( animation.opts.done, animation.opts.complete )
        .fail( animation.opts.fail )
        .always( animation.opts.always );
}

function propFilter( props, specialEasing ) {
    var index, name, easing, value, hooks;

    // camelCase, specialEasing and expand cssHook pass
    for ( index in props ) {
        name = jQuery.camelCase( index );
        easing = specialEasing[ name ];
        value = props[ index ];
        if ( jQuery.isArray( value ) ) {
            easing = value[ 1 ];
            value = props[ index ] = value[ 0 ];
        }

        if ( index !== name ) {
            props[ name ] = value;
            delete props[ index ];
        }

        hooks = jQuery.cssHooks[ name ];
        if ( hooks && "expand" in hooks ) {
            value = hooks.expand( value );
            delete props[ name ];

            // not quite $.extend, this wont overwrite keys already present.
            // also - reusing 'index' from above because we have the correct "name"
            for ( index in value ) {
                if ( !( index in props ) ) {
                    props[ index ] = value[ index ];
                    specialEasing[ index ] = easing;
                }
            }
        } else {
            specialEasing[ name ] = easing;
        }
    }
}

jQuery.Animation = jQuery.extend( Animation, {

    tweener: function( props, callback ) {
        if ( jQuery.isFunction( props ) ) {
            callback = props;
            props = [ "*" ];
        } else {
            props = props.split(" ");
        }

        var prop,
            index = 0,
            length = props.length;

        for ( ; index < length ; index++ ) {
            prop = props[ index ];
            tweeners[ prop ] = tweeners[ prop ] || [];
            tweeners[ prop ].unshift( callback );
        }
    },

    prefilter: function( callback, prepend ) {
        if ( prepend ) {
            animationPrefilters.unshift( callback );
        } else {
            animationPrefilters.push( callback );
        }
    }
});

function defaultPrefilter( elem, props, opts ) {
    var index, prop, value, length, dataShow, toggle, tween, hooks, oldfire,
        anim = this,
        style = elem.style,
        orig = {},
        handled = [],
        hidden = elem.nodeType && isHidden( elem );

    // handle queue: false promises
    if ( !opts.queue ) {
        hooks = jQuery._queueHooks( elem, "fx" );
        if ( hooks.unqueued == null ) {
            hooks.unqueued = 0;
            oldfire = hooks.empty.fire;
            hooks.empty.fire = function() {
                if ( !hooks.unqueued ) {
                    oldfire();
                }
            };
        }
        hooks.unqueued++;

        anim.always(function() {
            // doing this makes sure that the complete handler will be called
            // before this completes
            anim.always(function() {
                hooks.unqueued--;
                if ( !jQuery.queue( elem, "fx" ).length ) {
                    hooks.empty.fire();
                }
            });
        });
    }

    // height/width overflow pass
    if ( elem.nodeType === 1 && ( "height" in props || "width" in props ) ) {
        // Make sure that nothing sneaks out
        // Record all 3 overflow attributes because IE does not
        // change the overflow attribute when overflowX and
        // overflowY are set to the same value
        opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

        // Set display property to inline-block for height/width
        // animations on inline elements that are having width/height animated
        if ( jQuery.css( elem, "display" ) === "inline" &&
                jQuery.css( elem, "float" ) === "none" ) {

            // inline-level elements accept inline-block;
            // block-level elements need to be inline with layout
            if ( !jQuery.support.inlineBlockNeedsLayout || css_defaultDisplay( elem.nodeName ) === "inline" ) {
                style.display = "inline-block";

            } else {
                style.zoom = 1;
            }
        }
    }

    if ( opts.overflow ) {
        style.overflow = "hidden";
        if ( !jQuery.support.shrinkWrapBlocks ) {
            anim.done(function() {
                style.overflow = opts.overflow[ 0 ];
                style.overflowX = opts.overflow[ 1 ];
                style.overflowY = opts.overflow[ 2 ];
            });
        }
    }


    // show/hide pass
    for ( index in props ) {
        value = props[ index ];
        if ( rfxtypes.exec( value ) ) {
            delete props[ index ];
            toggle = toggle || value === "toggle";
            if ( value === ( hidden ? "hide" : "show" ) ) {
                continue;
            }
            handled.push( index );
        }
    }

    length = handled.length;
    if ( length ) {
        dataShow = jQuery._data( elem, "fxshow" ) || jQuery._data( elem, "fxshow", {} );
        if ( "hidden" in dataShow ) {
            hidden = dataShow.hidden;
        }

        // store state if its toggle - enables .stop().toggle() to "reverse"
        if ( toggle ) {
            dataShow.hidden = !hidden;
        }
        if ( hidden ) {
            jQuery( elem ).show();
        } else {
            anim.done(function() {
                jQuery( elem ).hide();
            });
        }
        anim.done(function() {
            var prop;
            jQuery.removeData( elem, "fxshow", true );
            for ( prop in orig ) {
                jQuery.style( elem, prop, orig[ prop ] );
            }
        });
        for ( index = 0 ; index < length ; index++ ) {
            prop = handled[ index ];
            tween = anim.createTween( prop, hidden ? dataShow[ prop ] : 0 );
            orig[ prop ] = dataShow[ prop ] || jQuery.style( elem, prop );

            if ( !( prop in dataShow ) ) {
                dataShow[ prop ] = tween.start;
                if ( hidden ) {
                    tween.end = tween.start;
                    tween.start = prop === "width" || prop === "height" ? 1 : 0;
                }
            }
        }
    }
}

function Tween( elem, options, prop, end, easing ) {
    return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
    constructor: Tween,
    init: function( elem, options, prop, end, easing, unit ) {
        this.elem = elem;
        this.prop = prop;
        this.easing = easing || "swing";
        this.options = options;
        this.start = this.now = this.cur();
        this.end = end;
        this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
    },
    cur: function() {
        var hooks = Tween.propHooks[ this.prop ];

        return hooks && hooks.get ?
            hooks.get( this ) :
            Tween.propHooks._default.get( this );
    },
    run: function( percent ) {
        var eased,
            hooks = Tween.propHooks[ this.prop ];

        if ( this.options.duration ) {
            this.pos = eased = jQuery.easing[ this.easing ](
                percent, this.options.duration * percent, 0, 1, this.options.duration
            );
        } else {
            this.pos = eased = percent;
        }
        this.now = ( this.end - this.start ) * eased + this.start;

        if ( this.options.step ) {
            this.options.step.call( this.elem, this.now, this );
        }

        if ( hooks && hooks.set ) {
            hooks.set( this );
        } else {
            Tween.propHooks._default.set( this );
        }
        return this;
    }
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
    _default: {
        get: function( tween ) {
            var result;

            if ( tween.elem[ tween.prop ] != null &&
                (!tween.elem.style || tween.elem.style[ tween.prop ] == null) ) {
                return tween.elem[ tween.prop ];
            }

            // passing any value as a 4th parameter to .css will automatically
            // attempt a parseFloat and fallback to a string if the parse fails
            // so, simple values such as "10px" are parsed to Float.
            // complex values such as "rotate(1rad)" are returned as is.
            result = jQuery.css( tween.elem, tween.prop, false, "" );
            // Empty strings, null, undefined and "auto" are converted to 0.
            return !result || result === "auto" ? 0 : result;
        },
        set: function( tween ) {
            // use step hook for back compat - use cssHook if its there - use .style if its
            // available and use plain properties where available
            if ( jQuery.fx.step[ tween.prop ] ) {
                jQuery.fx.step[ tween.prop ]( tween );
            } else if ( tween.elem.style && ( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null || jQuery.cssHooks[ tween.prop ] ) ) {
                jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
            } else {
                tween.elem[ tween.prop ] = tween.now;
            }
        }
    }
};

// Remove in 2.0 - this supports IE8's panic based approach
// to setting things on disconnected nodes

Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
    set: function( tween ) {
        if ( tween.elem.nodeType && tween.elem.parentNode ) {
            tween.elem[ tween.prop ] = tween.now;
        }
    }
};

jQuery.each([ "toggle", "show", "hide" ], function( i, name ) {
    var cssFn = jQuery.fn[ name ];
    jQuery.fn[ name ] = function( speed, easing, callback ) {
        return speed == null || typeof speed === "boolean" ||
            // special check for .toggle( handler, handler, ... )
            ( !i && jQuery.isFunction( speed ) && jQuery.isFunction( easing ) ) ?
            cssFn.apply( this, arguments ) :
            this.animate( genFx( name, true ), speed, easing, callback );
    };
});

jQuery.fn.extend({
    fadeTo: function( speed, to, easing, callback ) {

        // show any hidden elements after setting opacity to 0
        return this.filter( isHidden ).css( "opacity", 0 ).show()

            // animate to the value specified
            .end().animate({ opacity: to }, speed, easing, callback );
    },
    animate: function( prop, speed, easing, callback ) {
        var empty = jQuery.isEmptyObject( prop ),
            optall = jQuery.speed( speed, easing, callback ),
            doAnimation = function() {
                // Operate on a copy of prop so per-property easing won't be lost
                var anim = Animation( this, jQuery.extend( {}, prop ), optall );

                // Empty animations resolve immediately
                if ( empty ) {
                    anim.stop( true );
                }
            };

        return empty || optall.queue === false ?
            this.each( doAnimation ) :
            this.queue( optall.queue, doAnimation );
    },
    stop: function( type, clearQueue, gotoEnd ) {
        var stopQueue = function( hooks ) {
            var stop = hooks.stop;
            delete hooks.stop;
            stop( gotoEnd );
        };

        if ( typeof type !== "string" ) {
            gotoEnd = clearQueue;
            clearQueue = type;
            type = undefined;
        }
        if ( clearQueue && type !== false ) {
            this.queue( type || "fx", [] );
        }

        return this.each(function() {
            var dequeue = true,
                index = type != null && type + "queueHooks",
                timers = jQuery.timers,
                data = jQuery._data( this );

            if ( index ) {
                if ( data[ index ] && data[ index ].stop ) {
                    stopQueue( data[ index ] );
                }
            } else {
                for ( index in data ) {
                    if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
                        stopQueue( data[ index ] );
                    }
                }
            }

            for ( index = timers.length; index--; ) {
                if ( timers[ index ].elem === this && (type == null || timers[ index ].queue === type) ) {
                    timers[ index ].anim.stop( gotoEnd );
                    dequeue = false;
                    timers.splice( index, 1 );
                }
            }

            // start the next in the queue if the last step wasn't forced
            // timers currently will call their complete callbacks, which will dequeue
            // but only if they were gotoEnd
            if ( dequeue || !gotoEnd ) {
                jQuery.dequeue( this, type );
            }
        });
    }
});

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
    var which,
        attrs = { height: type },
        i = 0;

    // if we include width, step value is 1 to do all cssExpand values,
    // if we don't include width, step value is 2 to skip over Left and Right
    includeWidth = includeWidth? 1 : 0;
    for( ; i < 4 ; i += 2 - includeWidth ) {
        which = cssExpand[ i ];
        attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
    }

    if ( includeWidth ) {
        attrs.opacity = attrs.width = type;
    }

    return attrs;
}

// Generate shortcuts for custom animations
jQuery.each({
    slideDown: genFx("show"),
    slideUp: genFx("hide"),
    slideToggle: genFx("toggle"),
    fadeIn: { opacity: "show" },
    fadeOut: { opacity: "hide" },
    fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
    jQuery.fn[ name ] = function( speed, easing, callback ) {
        return this.animate( props, speed, easing, callback );
    };
});

jQuery.speed = function( speed, easing, fn ) {
    var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
        complete: fn || !fn && easing ||
            jQuery.isFunction( speed ) && speed,
        duration: speed,
        easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
    };

    opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
        opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;

    // normalize opt.queue - true/undefined/null -> "fx"
    if ( opt.queue == null || opt.queue === true ) {
        opt.queue = "fx";
    }

    // Queueing
    opt.old = opt.complete;

    opt.complete = function() {
        if ( jQuery.isFunction( opt.old ) ) {
            opt.old.call( this );
        }

        if ( opt.queue ) {
            jQuery.dequeue( this, opt.queue );
        }
    };

    return opt;
};

jQuery.easing = {
    linear: function( p ) {
        return p;
    },
    swing: function( p ) {
        return 0.5 - Math.cos( p*Math.PI ) / 2;
    }
};

jQuery.timers = [];
jQuery.fx = Tween.prototype.init;
jQuery.fx.tick = function() {
    var timer,
        timers = jQuery.timers,
        i = 0;

    fxNow = jQuery.now();

    for ( ; i < timers.length; i++ ) {
        timer = timers[ i ];
        // Checks the timer has not already been removed
        if ( !timer() && timers[ i ] === timer ) {
            timers.splice( i--, 1 );
        }
    }

    if ( !timers.length ) {
        jQuery.fx.stop();
    }
    fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
    if ( timer() && jQuery.timers.push( timer ) && !timerId ) {
        timerId = setInterval( jQuery.fx.tick, jQuery.fx.interval );
    }
};

jQuery.fx.interval = 13;

jQuery.fx.stop = function() {
    clearInterval( timerId );
    timerId = null;
};

jQuery.fx.speeds = {
    slow: 600,
    fast: 200,
    // Default speed
    _default: 400
};

// Back Compat <1.8 extension point
jQuery.fx.step = {};

if ( jQuery.expr && jQuery.expr.filters ) {
    jQuery.expr.filters.animated = function( elem ) {
        return jQuery.grep(jQuery.timers, function( fn ) {
            return elem === fn.elem;
        }).length;
    };
}
var rroot = /^(?:body|html)$/i;

jQuery.fn.offset = function( options ) {
    if ( arguments.length ) {
        return options === undefined ?
            this :
            this.each(function( i ) {
                jQuery.offset.setOffset( this, options, i );
            });
    }

    var docElem, body, win, clientTop, clientLeft, scrollTop, scrollLeft,
        box = { top: 0, left: 0 },
        elem = this[ 0 ],
        doc = elem && elem.ownerDocument;

    if ( !doc ) {
        return;
    }

    if ( (body = doc.body) === elem ) {
        return jQuery.offset.bodyOffset( elem );
    }

    docElem = doc.documentElement;

    // Make sure it's not a disconnected DOM node
    if ( !jQuery.contains( docElem, elem ) ) {
        return box;
    }

    // If we don't have gBCR, just use 0,0 rather than error
    // BlackBerry 5, iOS 3 (original iPhone)
    if ( typeof elem.getBoundingClientRect !== "undefined" ) {
        box = elem.getBoundingClientRect();
    }
    win = getWindow( doc );
    clientTop  = docElem.clientTop  || body.clientTop  || 0;
    clientLeft = docElem.clientLeft || body.clientLeft || 0;
    scrollTop  = win.pageYOffset || docElem.scrollTop;
    scrollLeft = win.pageXOffset || docElem.scrollLeft;
    return {
        top: box.top  + scrollTop  - clientTop,
        left: box.left + scrollLeft - clientLeft
    };
};

jQuery.offset = {

    bodyOffset: function( body ) {
        var top = body.offsetTop,
            left = body.offsetLeft;

        if ( jQuery.support.doesNotIncludeMarginInBodyOffset ) {
            top  += parseFloat( jQuery.css(body, "marginTop") ) || 0;
            left += parseFloat( jQuery.css(body, "marginLeft") ) || 0;
        }

        return { top: top, left: left };
    },

    setOffset: function( elem, options, i ) {
        var position = jQuery.css( elem, "position" );

        // set position first, in-case top/left are set even on static elem
        if ( position === "static" ) {
            elem.style.position = "relative";
        }

        var curElem = jQuery( elem ),
            curOffset = curElem.offset(),
            curCSSTop = jQuery.css( elem, "top" ),
            curCSSLeft = jQuery.css( elem, "left" ),
            calculatePosition = ( position === "absolute" || position === "fixed" ) && jQuery.inArray("auto", [curCSSTop, curCSSLeft]) > -1,
            props = {}, curPosition = {}, curTop, curLeft;

        // need to be able to calculate position if either top or left is auto and position is either absolute or fixed
        if ( calculatePosition ) {
            curPosition = curElem.position();
            curTop = curPosition.top;
            curLeft = curPosition.left;
        } else {
            curTop = parseFloat( curCSSTop ) || 0;
            curLeft = parseFloat( curCSSLeft ) || 0;
        }

        if ( jQuery.isFunction( options ) ) {
            options = options.call( elem, i, curOffset );
        }

        if ( options.top != null ) {
            props.top = ( options.top - curOffset.top ) + curTop;
        }
        if ( options.left != null ) {
            props.left = ( options.left - curOffset.left ) + curLeft;
        }

        if ( "using" in options ) {
            options.using.call( elem, props );
        } else {
            curElem.css( props );
        }
    }
};


jQuery.fn.extend({

    position: function() {
        if ( !this[0] ) {
            return;
        }

        var elem = this[0],

        // Get *real* offsetParent
        offsetParent = this.offsetParent(),

        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rroot.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset();

        // Subtract element margins
        // note: when an element has margin: auto the offsetLeft and marginLeft
        // are the same in Safari causing offset.left to incorrectly be 0
        offset.top  -= parseFloat( jQuery.css(elem, "marginTop") ) || 0;
        offset.left -= parseFloat( jQuery.css(elem, "marginLeft") ) || 0;

        // Add offsetParent borders
        parentOffset.top  += parseFloat( jQuery.css(offsetParent[0], "borderTopWidth") ) || 0;
        parentOffset.left += parseFloat( jQuery.css(offsetParent[0], "borderLeftWidth") ) || 0;

        // Subtract the two offsets
        return {
            top:  offset.top  - parentOffset.top,
            left: offset.left - parentOffset.left
        };
    },

    offsetParent: function() {
        return this.map(function() {
            var offsetParent = this.offsetParent || document.body;
            while ( offsetParent && (!rroot.test(offsetParent.nodeName) && jQuery.css(offsetParent, "position") === "static") ) {
                offsetParent = offsetParent.offsetParent;
            }
            return offsetParent || document.body;
        });
    }
});


// Create scrollLeft and scrollTop methods
jQuery.each( {scrollLeft: "pageXOffset", scrollTop: "pageYOffset"}, function( method, prop ) {
    var top = /Y/.test( prop );

    jQuery.fn[ method ] = function( val ) {
        return jQuery.access( this, function( elem, method, val ) {
            var win = getWindow( elem );

            if ( val === undefined ) {
                return win ? (prop in win) ? win[ prop ] :
                    win.document.documentElement[ method ] :
                    elem[ method ];
            }

            if ( win ) {
                win.scrollTo(
                    !top ? val : jQuery( win ).scrollLeft(),
                     top ? val : jQuery( win ).scrollTop()
                );

            } else {
                elem[ method ] = val;
            }
        }, method, val, arguments.length, null );
    };
});

function getWindow( elem ) {
    return jQuery.isWindow( elem ) ?
        elem :
        elem.nodeType === 9 ?
            elem.defaultView || elem.parentWindow :
            false;
}
// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
    jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name }, function( defaultExtra, funcName ) {
        // margin is only for outerHeight, outerWidth
        jQuery.fn[ funcName ] = function( margin, value ) {
            var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
                extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

            return jQuery.access( this, function( elem, type, value ) {
                var doc;

                if ( jQuery.isWindow( elem ) ) {
                    // As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
                    // isn't a whole lot we can do. See pull request at this URL for discussion:
                    // https://github.com/jquery/jquery/pull/764
                    return elem.document.documentElement[ "client" + name ];
                }

                // Get document width or height
                if ( elem.nodeType === 9 ) {
                    doc = elem.documentElement;

                    // Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height], whichever is greatest
                    // unfortunately, this causes bug #3838 in IE6/8 only, but there is currently no good, small way to fix it.
                    return Math.max(
                        elem.body[ "scroll" + name ], doc[ "scroll" + name ],
                        elem.body[ "offset" + name ], doc[ "offset" + name ],
                        doc[ "client" + name ]
                    );
                }

                return value === undefined ?
                    // Get width or height on the element, requesting but not forcing parseFloat
                    jQuery.css( elem, type, value, extra ) :

                    // Set width or height on the element
                    jQuery.style( elem, type, value, extra );
            }, type, chainable ? margin : undefined, chainable, null );
        };
    });
});
// Expose jQuery to the global object
window.jQuery = window.$ = jQuery;

// Expose jQuery as an AMD module, but only for AMD loaders that
// understand the issues with loading multiple versions of jQuery
// in a page that all might call define(). The loader will indicate
// they have special allowances for multiple jQuery versions by
// specifying define.amd.jQuery = true. Register as a named module,
// since jQuery can be concatenated with other files that may use define,
// but not use a proper concatenation script that understands anonymous
// AMD modules. A named AMD is safest and most robust way to register.
// Lowercase jquery is used because AMD module names are derived from
// file names, and jQuery is normally delivered in a lowercase file name.
// Do this after creating the global so that if an AMD module wants to call
// noConflict to hide this version of jQuery, it will work.
if ( typeof define === "function" && define.amd && define.amd.jQuery ) {
    define( "jquery", [], function () { return jQuery; } );
}

})( window );

define("jquery/jquery-1.8.3", function(){});

/**
 * Patterns logging - minimal logging framework
 *
 * Copyright 2012 Simplon B.V.
 */

(function() {
    // source: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                fNOP = function () {},
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP &&
                            oThis ? this : oThis,
                            aArgs.concat(Array.prototype.slice.call(arguments)));
                };
            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();

            return fBound;
        };
    }

    var root,    // root logger instance
        writer;  // writer instance, used to output log entries

    var Level = {
        DEBUG: 10,
        INFO: 20,
        WARN: 30,
        ERROR: 40,
        FATAL: 50
    };

    function IEConsoleWriter() {
    }

    IEConsoleWriter.prototype = {
        output:  function(log_name, level, messages) {
            // console.log will magically appear in IE8 when the user opens the
            // F12 Developer Tools, so we have to test for it every time.
            if (typeof window.console==="undefined" || typeof console.log==="undefined")
                    return;
            if (log_name)
                messages.unshift(log_name+":");
            var message = messages.join(" ");

            // Under some conditions console.log will be available but the
            // other functions are missing.
            if (typeof console.info===undefined) {
                var level_name;
                if (level<=Level.DEBUG)
                    level_name="DEBUG";
                else if (level<=Level.INFO)
                    level_name="INFO";
                else if (level<=Level.WARN)
                    level_name="WARN";
                else if (level<=Level.ERROR)
                    level_name="ERROR";
                else
                    level_name="FATAL";
                console.log("["+level_name+"] "+message);
            } else {
                if (level<=Level.DEBUG) {
                    // console.debug exists but is deprecated
                    message="[DEBUG] "+message;
                    console.log(message);
                } else if (level<=Level.INFO)
                    console.info(message);
                else if (level<=Level.WARN)
                    console.warn(message);
                else
                    console.error(message);
            }
        }
    };


    function ConsoleWriter() {
    }

    ConsoleWriter.prototype = {
        output: function(log_name, level, messages) {
            if (log_name)
                messages.unshift(log_name+":");
            if (level<=Level.DEBUG) {
                // console.debug exists but is deprecated
                messages.unshift("[DEBUG]");
                console.log.apply(console, messages);
            } else if (level<=Level.INFO)
                console.info.apply(console, messages);
            else if (level<=Level.WARN)
                console.warn.apply(console, messages);
            else
                console.error.apply(console, messages);
        }
    };


    function Logger(name, parent) {
        this._loggers={};
        this.name=name || "";
        this._parent=parent || null;
        if (!parent) {
            this._enabled=true;
            this._level=Level.WARN;
        }
    }

    Logger.prototype = {
        getLogger: function(name) {
            var path = name.split("."),
                root = this,
                route = this.name ? [this.name] : [];
            while (path.length) {
                var entry = path.shift();
                route.push(entry);
                if (!(entry in root._loggers))
                    root._loggers[entry] = new Logger(route.join("."), root);
                root=root._loggers[entry];
            }
            return root;
        },

        _getFlag: function(flag) {
            var context=this;
            flag="_"+flag;
            while (context!==null) {
                if (context[flag]!==undefined)
                    return context[flag];
                context=context._parent;
            }
            return null;
        },

        setEnabled: function(state) {
            this._enabled=!!state;
        },

        isEnabled: function() {
            this._getFlag("enabled");
        },

        setLevel: function(level) {
            if (typeof level==="number")
                this._level=level;
            else if (typeof level==="string") {
                level=level.toUpperCase();
                if (level in Level)
                    this._level=Level[level];
            }
        },

        getLevel: function() {
            return this._getFlag("level");
        },

        log: function(level, messages) {
            if (!messages.length || !this._getFlag("enabled") || level<this._getFlag("level"))
                return;
            messages=Array.prototype.slice.call(messages);
            writer.output(this.name, level, messages);
        },

        debug: function() {
            this.log(Level.DEBUG, arguments);
        },

        info: function() {
            this.log(Level.INFO, arguments);
        },

        warn: function() {
            this.log(Level.WARN, arguments);
        },

        error: function() {
            this.log(Level.ERROR, arguments);
        },

        fatal: function() {
            this.log(Level.FATAL, arguments);
        }
    };

    function getWriter() {
        return writer;
    }

    function setWriter(w) {
        writer=w;
    }

    if (window.console && window.console.log && window.console.log.apply!==undefined)
        setWriter(new ConsoleWriter());
    else
        setWriter(new IEConsoleWriter());

    root=new Logger();

    var logconfig = /loglevel(|-[^=]+)=([^&]+)/g,
        match;

    while ((match=logconfig.exec(window.location.search))!==null) {
        var logger = (match[1]==="") ? root : root.getLogger(match[1].slice(1));
        logger.setLevel(match[2].toUpperCase());
    }

    var api = {
        Level: Level,
        getLogger: root.getLogger.bind(root),
        setEnabled: root.setEnabled.bind(root),
        isEnabled: root.isEnabled.bind(root),
        setLevel: root.setLevel.bind(root),
        getLevel: root.getLevel.bind(root),
        debug: root.debug.bind(root),
        info: root.info.bind(root),
        warn: root.warn.bind(root),
        error: root.error.bind(root),
        fatal: root.fatal.bind(root),
        getWriter: getWriter,
        setWriter: setWriter
    };

    // Expose as either an AMD module if possible. If not fall back to exposing
    // a global object.
    if (typeof define==="function")
        define("logging", [], function () {
            return api;
        });
    else
        window.logging=api;
})();

define("logging/logging", function(){});

/**
 * Patterns logger - wrapper around logging library
 *
 * Copyright 2012-2013 Florian Friesdorf
 */
define('core/logger',[
    'logging'
], function(logging) {
    var log = logging.getLogger('patterns');
    return log;
});

/**
 * Patterns parser - Argument parser
 *
 * Copyright 2012-2013 Florian Friesdorf
 * Copyright 2012-2013 Simplon B.V. - Wichert Akkerman
 */
define('core/parser',[
    'jquery',
    './logger'
], function($, logger) {
    function ArgumentParser(name, opts) {
        opts = opts || {};
        this.inherit = typeof opts.inherit === "undefined" ?
            true : opts.inherit;
        this.order = [];
        this.parameters = {};
        this.attribute = "data-pat-" + name;
        this.enum_values = {};
        this.enum_conflicts = [];
        this.groups = {};
        this.possible_groups = {};
        this.log = logger.getLogger(name + ".parser");
    }

    ArgumentParser.prototype = {
        group_pattern: /([a-z][a-z0-9]*)-([A-Z][a-z0-0\-]*)/i,
        named_param_pattern: /^\s*([a-z][a-z0-9\-]*)\s*:(.*)/i,
        token_pattern: /((["']).*?(?!\\)\2)|\s*(\S+)\s*/g,

        _camelCase: function(str) {
            return str.replace(/\-([a-z])/g, function(_, p1){
                return p1.toUpperCase();
            });
        },

        add_argument: function(name, default_value, choices, multiple) {
            var spec, m;

            if (multiple && !Array.isArray(default_value))
                default_value=[default_value];
            spec={name: name,
                  value: default_value,
                  multiple: multiple,
                  dest: name,
                  group: null};

            if (choices && Array.isArray(choices) && choices.length) {
                spec.choices=choices;
                spec.type=this._typeof(choices[0]);
                for (var i=0; i<choices.length; i++)
                    if (this.enum_conflicts.indexOf(choices[i])!==-1)
                        continue;
                    else if (choices[i] in this.enum_values) {
                        this.enum_conflicts.push(choices[i]);
                        delete this.enum_values[choices[i]];
                    } else
                        this.enum_values[choices[i]]=name;
            } else if (typeof spec.value==="string" && spec.value.slice(0, 1)==="$")
                spec.type=this.parameters[spec.value.slice(1)].type;
            else
                // Note that this will get reset by _defaults if default_value is a function.
                spec.type=this._typeof(multiple ? spec.value[0] : spec.value);

            m=name.match(this.group_pattern);
            if (m) {
                var group=m[1], field=m[2];
                if (group in this.possible_groups) {
                    var first_spec = this.possible_groups[group],
                        first_name = first_spec.name.match(this.group_pattern)[2];
                    first_spec.group=group;
                    first_spec.dest=first_name;
                    this.groups[group]=new ArgumentParser();
                    this.groups[group].add_argument(
                            first_name,
                            spec.value, spec.cohices, spec.multiple);
                    delete this.possible_groups[group];
                }
                if (group in this.groups) {
                    this.groups[group].add_argument(field, default_value, choices, multiple);
                    spec.group=group;
                    spec.dest=field;
                } else {
                    this.possible_groups[group]=spec;
                    spec.dest=this._camelCase(spec.name);
                }
            }
            this.order.push(name);
            this.parameters[name]=spec;
        },

        _typeof: function(obj) {
            var type = typeof obj;
            if (obj===null)
                return "null";
            return type;
        },

        _coerce: function(name, value) {
            var spec=this.parameters[name];

            if (typeof value !== spec.type)
                try {
                    switch (spec.type) {
                        case "boolean":
                            if (typeof value === "string") {
                                value=value.toLowerCase();
                                var num = parseInt(value, 10);
                                if (!isNaN(num))
                                    value=!!num;
                                else
                                    value=(value==="true" || value==="y" || value==="yes" || value==="y");
                            } else if (typeof value === "number")
                                value=!!value;
                            else
                                throw ("Cannot convert value for " + name + " to boolean");
                            break;
                        case "number":
                            if (typeof value === "string") {
                                value=parseInt(value, 10);
                                if (isNaN(value))
                                    throw ("Cannot convert value for " + name + " to number");
                            } else if (typeof value === "boolean")
                                value=value + 0;
                            else
                                throw ("Cannot convert value for " + name + " to number");
                            break;
                        case "string":
                            value=value.toString();
                            break;
                        case "null":  // Missing default values
                        case "undefined":
                            break;
                        default:
                            throw ("Do not know how to convert value for " + name + " to " + spec.type);
                    }
                } catch (e) {
                    this.log.warn(e);
                    return null;
                }

            if (spec.choices && spec.choices.indexOf(value)===-1) {
                this.log.warn("Illegal value for " + name + ": " + value);
                return null;
            }

            return value;
        },

        _set: function(opts, name, value) {
            if (!(name in this.parameters)) {
                this.log.debug("Ignoring value for unknown argument " + name);
                return;
            }

            var spec=this.parameters[name];
            if (spec.multiple) {
                var parts=value.split(/,+/), i, v;
                value=[];
                for (i=0; i<parts.length; i++) {
                    v=this._coerce(name, parts[i].trim());
                    if (v!==null)
                        value.push(v);
                }
            } else {
                value=this._coerce(name, value);
                if (value===null)
                    return;
            }

            opts[name]=value;
        },

        _split: function(text) {
            var tokens = [];

            text.replace(this.token_pattern, function(match, quoted, _, simple) {
                if (quoted)
                    tokens.push(quoted);
                else if (simple)
                    tokens.push(simple);
            });
            return tokens;
        },

        _parseExtendedNotation: function(parameter) {
            var opts = {}, i,
                parts, matches;

            parts = parameter.replace(";;", "\xff")
                        .split(";")
                        .map(function(el) { return el.replace("\xff", ";"); });
            for (i=0; i<parts.length; i++) {
                if (!parts[i])
                    continue;

                matches = parts[i].match(this.named_param_pattern);
                if (!matches) {
                    this.log.warn("Invalid parameter: " + parts[i]);
                    break;
                }

                var name = matches[1],
                    value = matches[2].trim();

                if (name in this.parameters)
                    this._set(opts, name, value);
                else if (name in this.groups) {
                    var subopt = this.groups[name]._parseShorthandNotation(value);
                    for (var field in subopt)
                        this._set(opts, name+"-"+field, subopt[field]);
                } else {
                    this.log.warn("Unknown named parameter " + matches[1]);
                    continue;
                }
            }

            return opts;
        },

        _parseShorthandNotation: function(parameter) {
            var parts = this._split(parameter),
                opts = {},
                positional = true,
                i, part, flag, sense;

            i=0;
            while (parts.length) {
                part=parts.shift().trim();
                if (part.slice(0, 3)==="no-") {
                    sense=false;
                    flag=part.slice(3);
                } else {
                    sense=true;
                    flag=part;
                }
                if (flag in this.parameters && this.parameters[flag].type==="boolean") {
                    positional=false;
                    this._set(opts, flag, sense);
                } else if (flag in this.enum_values) {
                    positional=false;
                    this._set(opts, this.enum_values[flag], flag);
                } else if (positional)
                    this._set(opts, this.order[i], part);
                else {
                    parts.unshift(part);
                    break;
                }

                i++;
                if (i>=this.order.length)
                    break;
            }
            if (parts.length)
                this.log.warn("Ignore extra arguments: " + parts.join(" "));
            return opts;
        },

        _parse: function(parameter) {
            var opts, extended, sep;

            if (!parameter)
                return {};

            if (parameter.match(this.named_param_pattern))
                return this._parseExtendedNotation(parameter);

            sep=parameter.indexOf(";");
            if (sep===-1)
                return this._parseShorthandNotation(parameter);

            opts=this._parseShorthandNotation(parameter.slice(0, sep));
            extended=this._parseExtendedNotation(parameter.slice(sep+1));
            for (var name in extended)
                opts[name]=extended[name];
            return opts;
        },

        _defaults: function($el) {
            var result = {};
            for (var name in this.parameters)
                if (typeof this.parameters[name].value==="function")
                    try {
                        result[name]=this.parameters[name].value($el, name);
                        this.parameters[name].type=typeof result[name];
                    } catch(e) {
                        this.log.error("Default function for " + name + " failed.");
                    }
                else
                    result[name]=this.parameters[name].value;
            return result;
        },

        _cleanupOptions: function(options) {
            var keys = Object.keys(options),
                i, spec, name, target;

            // Resolve references
            for (i=0; i<keys.length; i++) {
                name=keys[i];
                spec=this.parameters[name];
                if (spec===undefined)
                    continue;

                if (options[name]===spec.value &&
                        typeof spec.value==="string" && spec.value.slice(0, 1)==="$")
                    options[name]=options[spec.value.slice(1)];
            }

            // Move options into groups and do renames
            keys=Object.keys(options);
            for (i=0; i<keys.length; i++) {
                name=keys[i];
                spec=this.parameters[name];
                if (spec===undefined)
                    continue;

                if (spec.group)  {
                    if (typeof options[spec.group]!=="object")
                        options[spec.group]={};
                    target=options[spec.group];
                } else
                    target=options;

                if (spec.dest!==name) {
                    target[spec.dest]=options[name];
                    delete options[name];
                }
            }
        },

        parse: function($el, options, multiple) {
            if (typeof options==="boolean" && multiple===undefined) {
                multiple=options;
                options={};
            }

            var stack = [[this._defaults($el)]];

            var $possible_config_providers = this.inherit ?
                    $el.parents().andSelf() : $el,
                final_length = 1,
                i, data, frame;
            for (i=0; i<$possible_config_providers.length; i++) {
                data = $possible_config_providers.eq(i).attr(this.attribute);
                if (data) {
                    var _parse = this._parse.bind(this); // Needed to fix binding in map call
                    if (data.match(/&&/))
                        frame=data.split(/\s*&&\s*/).map(_parse);
                    else
                        frame=[_parse(data)];
                    final_length = Math.max(frame.length, final_length);
                    stack.push(frame);
                }
            }
            if (typeof options==="object") {
                if (Array.isArray(options)) {
                    stack.push(options);
                    final_length=Math.max(options.length, final_length);
                } else
                    stack.push([options]);
            }

            if (!multiple)
                final_length=1;

            var results=[], frame_length, x, xf;
            for (i=0; i<final_length; i++)
                results.push({});

            for (i=0; i<stack.length; i++) {
                frame=stack[i];
                frame_length=frame.length-1;

                for (x=0; x<final_length; x++) {
                    xf=(x>frame_length) ? frame_length : x;
                    results[x]=$.extend(results[x], frame[xf]);
                }
            }

            for (i=0; i<results.length; i++)
                this._cleanupOptions(results[i]);

            return multiple ? results : results[0];
        }
    };

    return ArgumentParser;
});
// jshint indent: 4, browser: true, jquery: true, quotmark: double
// vim: sw=4 expandtab
;
define('utils',[
    "jquery"
], function($) {
    var jquery_plugin = function(pattern) {
        var plugin = function(method) {
            var $this = this;
            if ($this.length === 0)
                return $this;
            if (!method || typeof method === "object") {
                pattern.init.apply(
                    $this,
                    [$this].concat(Array.prototype.slice.call(arguments)));
            } else if (pattern[method]) {
                return pattern[method].apply(
                    $this,
                    [$this].concat(Array.prototype.slice.call(arguments, 1))
                );
            } else {
                $.error("Method " + method +
                        " does not exist on jQuery." + pattern.name);
            }
            return $this;
        };
        return plugin;
    };

    //     Underscore.js 1.3.1
    //     (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
    //     Underscore is freely distributable under the MIT license.
    //     Portions of Underscore are inspired or borrowed from Prototype,
    //     Oliver Steele's Functional, and John Resig's Micro-Templating.
    //     For all details and documentation:
    //     http://documentcloud.github.com/underscore
    //
    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds.
    var debounce = function(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    var rebaseURL = function(base, url) {
        if (url.indexOf("://")!==-1 || url[0]==="/")
            return url;
        return base.slice(0, base.lastIndexOf("/")+1) + url;
    };

    function findLabel(input) {
        for (var label=input.parentNode; label && label.nodeType!==11; label=label.parentNode)
            if (label.tagName==="LABEL")
                return label;

        var $label;

        if (input.id)
            $label = $("label[for="+input.id+"]");
        if ($label && $label.length===0 && input.form)
            $label = $("label[for="+input.name+"]", input.form);
        if ($label && $label.length)
            return $label[0];
        else
            return null;
    }

    // Taken from http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
    function elementInViewport(el) {
       var rect = el.getBoundingClientRect(),
           docEl = document.documentElement,
           vWidth = window.innerWidth || docEl.clientWidth,
           vHeight = window.innerHeight || docEl.clientHeight;

        if (rect.right<0 || rect.bottom<0 || rect.left>vWidth || rect.top>vHeight)
            return false;
        return true;
    }


    // Taken from http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    function removeWildcardClass($targets, classes) {
        if (classes.indexOf("*")===-1)
            $targets.removeClass(classes);
        else {
            var matcher = classes.replace(/[\-\[\]{}()+?.,\\\^$|#\s]/g, "\\$&");
            matcher = matcher.replace(/[*]/g, ".*");
            matcher = new RegExp("^" + matcher + "$");
            $targets.filter("[class]").each(function() {
                var $this = $(this),
                    classes = $this.attr("class").split(/\s+/),
                    ok=[];
                for (var i=0; i<classes.length; i++)
                    if (!matcher.test(classes[i]))
                        ok.push(classes[i]);
                if (ok.length)
                    $this.attr("class", ok.join(" "));
                else
                    $this.removeAttr("class");
            });
        }
    }

    var transitions = {
        none: {hide: "hide", show: "show"},
        fade: {hide: "fadeOut", show: "fadeIn"},
        slide: {hide: "slideUp", show: "slideDown"}
    };

    function hideOrShow($slave, visible, options, pattern_name) {
        var duration = (options.transition==="css" || options.transition==="none") ? null : options.effect.duration;

        $slave.removeClass("visible hidden in-progress");
        var onComplete = function() {
            $slave
                .removeClass("in-progress")
                .addClass(visible ? "visible" : "hidden")
                .trigger("pat-update",
                        {pattern: pattern_name,
                         transition: "complete"});
        };
        if (!duration) {
            if (options.transition!=="css")
                $slave[visible ? "show" : "hide"]();
            onComplete();
        } else {
            var t = transitions[options.transition];
            $slave
                .addClass("in-progress")
                .trigger("pat-update",
                        {pattern: pattern_name,
                         transition: "start"});
            $slave[visible ? t.show : t.hide]({
                duration: duration,
                easing: options.effect.easing,
                complete: onComplete
            });
        }
    }

    var utils = {
        // pattern pimping - own module?
        jquery_plugin: jquery_plugin,
        debounce: debounce,
        escapeRegExp: escapeRegExp,
        rebaseURL: rebaseURL,
        findLabel: findLabel,
        elementInViewport: elementInViewport,
        removeWildcardClass: removeWildcardClass,
        hideOrShow: hideOrShow
    };

    return utils;
});

define('compat',[],function() {

    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/every (JS 1.6)
    if (!Array.prototype.every)
    {
        Array.prototype.every = function(fun /*, thisp */)
        {


            if (this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function")
                throw new TypeError();

            var thisp = arguments[1];
            for (var i = 0; i < len; i++)
            {
                if (i in t && !fun.call(thisp, t[i], i, t))
                    return false;
            }

            return true;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/filter (JS 1.6)
    if (!Array.prototype.filter) {
        Array.prototype.filter = function(fun /*, thisp */) {


            if (this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function")
                throw new TypeError();

            var res = [];
            var thisp = arguments[1];
            for (var i = 0; i < len; i++)
            {
                if (i in t)
                {
                    var val = t[i]; // in case fun mutates this
                    if (fun.call(thisp, val, i, t))
                        res.push(val);
                }
            }

            return res;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach (JS 1.6)
    // Production steps of ECMA-262, Edition 5, 15.4.4.18
    // Reference: http://es5.github.com/#x15.4.4.18
    if ( !Array.prototype.forEach ) {

        Array.prototype.forEach = function( callback, thisArg ) {

            var T, k;

            if ( this === null ) {
                throw new TypeError( " this is null or not defined" );
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0; // Hack to convert O.length to a UInt32

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if ( {}.toString.call(callback) !== "[object Function]" ) {
                throw new TypeError( callback + " is not a function" );
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if ( thisArg ) {
                T = thisArg;
            }

            // 6. Let k be 0
            k = 0;

            // 7. Repeat, while k < len
            while( k < len ) {

                var kValue;

                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if ( k in O ) {

                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[ k ];

                    // ii. Call the Call internal method of callback with T as the this value and
                    // argument list containing kValue, k, and O.
                    callback.call( T, kValue, k, O );
                }
                // d. Increase k by 1.
                k++;
            }
            // 8. return undefined
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf (JS 1.6)
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {

            if (this === null) {
                throw new TypeError();
            }
            var t = Object(this);
            var len = t.length >>> 0;
            if (len === 0) {
                return -1;
            }
            var n = 0;
            if (arguments.length > 0) {
                n = Number(arguments[1]);
                if (n !== n) { // shortcut for verifying if it's NaN
                    n = 0;
                } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
                    n = (n > 0 || -1) * Math.floor(Math.abs(n));
                }
            }
            if (n >= len) {
                return -1;
            }
            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
            for (; k < len; k++) {
                if (k in t && t[k] === searchElement) {
                    return k;
                }
            }
            return -1;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/lastIndexOf (JS 1.6)
    if (!Array.prototype.lastIndexOf) {
        Array.prototype.lastIndexOf = function(searchElement /*, fromIndex*/) {


            if (this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (len === 0)
                return -1;

            var n = len;
            if (arguments.length > 1)
            {
                n = Number(arguments[1]);
                if (n !== n)
                    n = 0;
                else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0))
                    n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }

            var k = n >= 0 ? Math.min(n, len - 1) : len - Math.abs(n);

            for (; k >= 0; k--)
            {
                if (k in t && t[k] === searchElement)
                    return k;
            }
            return -1;
        };
    }


    // source: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/map (JS 1.6)
    // Production steps of ECMA-262, Edition 5, 15.4.4.19
    // Reference: http://es5.github.com/#x15.4.4.19
    if (!Array.prototype.map) {
        Array.prototype.map = function(callback, thisArg) {

            var T, A, k;

            if (this === null) {
                throw new TypeError(" this is null or not defined");
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if ({}.toString.call(callback) !== "[object Function]") {
                throw new TypeError(callback + " is not a function");
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (thisArg) {
                T = thisArg;
            }

            // 6. Let A be a new array created as if by the expression new Array(len) where Array is
            // the standard built-in constructor with that name and len is the value of len.
            A = new Array(len);

            // 7. Let k be 0
            k = 0;

            // 8. Repeat, while k < len
            while(k < len) {

                var kValue, mappedValue;

                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {

                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[ k ];

                    // ii. Let mappedValue be the result of calling the Call internal method of callback
                    // with T as the this value and argument list containing kValue, k, and O.
                    mappedValue = callback.call(T, kValue, k, O);

                    // iii. Call the DefineOwnProperty internal method of A with arguments
                    // Pk, Property Descriptor {Value: mappedValue, Writable: true, Enumerable: true, Configurable: true},
                    // and false.

                    // In browsers that support Object.defineProperty, use the following:
                    // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

                    // For best browser support, use the following:
                    A[ k ] = mappedValue;
                }
                // d. Increase k by 1.
                k++;
            }

            // 9. return A
            return A;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/Reduce (JS 1.8)
    if (!Array.prototype.reduce) {
        Array.prototype.reduce = function reduce(accumulator){
            if (this===null || this===undefined) throw new TypeError("Object is null or undefined");
            var i = 0, l = this.length >> 0, curr;

            if(typeof accumulator !== "function") // ES5 : "If IsCallable(callbackfn) is false, throw a TypeError exception."
                throw new TypeError("First argument is not callable");

            if(arguments.length < 2) {
                if (l === 0) throw new TypeError("Array length is 0 and no second argument");
                curr = this[0];
                i = 1; // start accumulating at the second element
            }
            else
                curr = arguments[1];

            while (i < l) {
                if(i in this) curr = accumulator.call(undefined, curr, this[i], i, this);
                ++i;
            }

            return curr;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/ReduceRight (JS 1.8)
    if (!Array.prototype.reduceRight)
    {
        Array.prototype.reduceRight = function(callbackfn /*, initialValue */)
        {


            if (this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof callbackfn !== "function")
                throw new TypeError();

            // no value to return if no initial value, empty array
            if (len === 0 && arguments.length === 1)
                throw new TypeError();

            var k = len - 1;
            var accumulator;
            if (arguments.length >= 2)
            {
                accumulator = arguments[1];
            }
            else
            {
                do
                {
                    if (k in this)
                    {
                        accumulator = this[k--];
                        break;
                    }

                    // if array contains no values, no initial value to return
                    if (--k < 0)
                        throw new TypeError();
                }
                while (true);
            }

            while (k >= 0)
            {
                if (k in t)
                    accumulator = callbackfn.call(undefined, accumulator, t[k], k, t);
                k--;
            }

            return accumulator;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some (JS 1.6)
    if (!Array.prototype.some)
    {
        Array.prototype.some = function(fun /*, thisp */)
        {


            if (this === null)
                throw new TypeError();

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function")
                throw new TypeError();

            var thisp = arguments[1];
            for (var i = 0; i < len; i++)
            {
                if (i in t && fun.call(thisp, t[i], i, t))
                    return true;
            }

            return false;
        };
    }


    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/isArray (JS 1.8.5)
    if (!Array.isArray) {
        Array.isArray = function (arg) {
            return Object.prototype.toString.call(arg) === "[object Array]";
        };
    }

    // source: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/Trim (JS 1.8.1)
    if (!String.prototype.trim) {
        String.prototype.trim = function () {
            return this.replace(/^\s+|\s+$/g, "");
        };
    }

    // source: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                fNOP = function () {},
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP &&
                            oThis ? this : oThis,
                            aArgs.concat(Array.prototype.slice.call(arguments)));
                };
            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();

            return fBound;
        };
    }

    // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/keys
    if (!Object.keys) {
        Object.keys = (function () {
            var _hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !({toString: null}).propertyIsEnumerable("toString"),
            dontEnums = [
            "toString",
            "toLocaleString",
            "valueOf",
            "hasOwnProperty",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "constructor"
            ],
            dontEnumsLength = dontEnums.length;

            return function (obj) {
                if (typeof obj !== "object" && typeof obj !== "function" || obj === null)
                    throw new TypeError("Object.keys called on non-object");

                var result = [];
                for (var prop in obj)
                    if (_hasOwnProperty.call(obj, prop))
                        result.push(prop);

                if (hasDontEnumBug)
                    for (var i=0; i < dontEnumsLength; i++)
                        if (_hasOwnProperty.call(obj, dontEnums[i]))
                            result.push(dontEnums[i]);
                return result;
            };
        })();
    }
});

/**
 * @license
 * Patterns @VERSION@ jquery-ext - various jQuery extensions
 *
 * Copyright 2011 Humberto Sermeño
 */
define('jquery-ext',["jquery"], function($) {
    var methods = {
        init: function( options ) {
            var settings = {
                time: 3, /* time it will wait before moving to "timeout" after a move event */
                initialTime: 8, /* time it will wait before first adding the "timeout" class */
                exceptionAreas: [] /* IDs of elements that, if the mouse is over them, will reset the timer */
            };
            return this.each(function() {
                var $this = $(this),
                    data = $this.data("timeout");

                if (!data) {
                    if ( options ) {
                        $.extend( settings, options );
                    }
                    $this.data("timeout", {
                        "lastEvent": new Date(),
                        "trueTime": settings.time,
                        "time": settings.initialTime,
                        "untouched": true,
                        "inExceptionArea": false
                    });

                    $this.bind( "mouseover.timeout", methods.mouseMoved );
                    $this.bind( "mouseenter.timeout", methods.mouseMoved );

                    $(settings.exceptionAreas).each(function() {
                        $this.find(this)
                            .live( "mouseover.timeout", {"parent":$this}, methods.enteredException )
                            .live( "mouseleave.timeout", {"parent":$this}, methods.leftException );
                    });

                    if (settings.initialTime > 0)
                        $this.timeout("startTimer");
                    else
                        $this.addClass("timeout");
                }
            });
        },

        enteredException: function(event) {
            var data = event.data.parent.data("timeout");
            data.inExceptionArea = true;
            event.data.parent.data("timeout", data);
            event.data.parent.trigger("mouseover");
        },

        leftException: function(event) {
            var data = event.data.parent.data("timeout");
            data.inExceptionArea = false;
            event.data.parent.data("timeout", data);
        },

        destroy: function() {
            return this.each( function() {
                var $this = $(this),
                    data = $this.data("timeout");

                $(window).unbind(".timeout");
                data.timeout.remove();
                $this.removeData("timeout");
            });
        },

        mouseMoved: function() {
            var $this = $(this), data = $this.data("timeout");

            if ($this.hasClass("timeout")) {
                $this.removeClass("timeout");
                $this.timeout("startTimer");
            } else if ( data.untouched ) {
                data.untouched = false;
                data.time = data.trueTime;
            }

            data.lastEvent = new Date();
            $this.data("timeout", data);
        },

        startTimer: function() {
            var $this = $(this), data = $this.data("timeout");
            var fn = function(){
                var data = $this.data("timeout");
                if ( data && data.lastEvent ) {
                    if ( data.inExceptionArea ) {
                        setTimeout( fn, Math.floor( data.time*1000 ) );
                    } else {
                        var now = new Date();
                        var diff = Math.floor(data.time*1000) - ( now - data.lastEvent );
                        if ( diff > 0 ) {
                            // the timeout has not ocurred, so set the timeout again
                            setTimeout( fn, diff+100 );
                        } else {
                            // timeout ocurred, so set the class
                            $this.addClass("timeout");
                        }
                    }
                }
            };

            setTimeout( fn, Math.floor( data.time*1000 ) );
        }
    };

    $.fn.timeout = function( method ) {
        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === "object" || !method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( "Method " + method + " does not exist on jQuery.timeout" );
        }
    };

    // Custom jQuery selector to find elements with scrollbars
    $.extend($.expr[":"], {
        scrollable: function(element) {
            var vertically_scrollable, horizontally_scrollable;
            if ($(element).css("overflow") === "scroll" ||
                $(element).css("overflowX") === "scroll" ||
                $(element).css("overflowY") === "scroll")
                return true;

            vertically_scrollable = (element.clientHeight < element.scrollHeight) && (
                $.inArray($(element).css("overflowY"), ["scroll", "auto"]) !== -1 || $.inArray($(element).css("overflow"), ["scroll", "auto"]) !== -1);

            if (vertically_scrollable)
                return true;

            horizontally_scrollable = (element.clientWidth < element.scrollWidth) && (
                $.inArray($(element).css("overflowX"), ["scroll", "auto"]) !== -1 || $.inArray($(element).css("overflow"), ["scroll", "auto"]) !== -1);
            return horizontally_scrollable;
        }
    });

    // Make Visible in scroll
    $.fn.makeVisibleInScroll = function( parent_id ) {
        var absoluteParent = null;
        if ( typeof parent_id === "string" ) {
            absoluteParent = $("#" + parent_id);
        } else if ( parent_id ) {
            absoluteParent = $(parent_id);
        }

        return this.each(function() {
            var $this = $(this), parent;
            if (!absoluteParent) {
                parent = $this.parents(":scrollable");
                if (parent.length > 0) {
                    parent = $(parent[0]);
                } else {
                    parent = $(window);
                }
            } else {
                parent = absoluteParent;
            }

            var elemTop = $this.position().top;
            var elemBottom = $this.height() + elemTop;

            var viewTop = parent.scrollTop();
            var viewBottom = parent.height() + viewTop;

            if (elemTop < viewTop) {
                parent.scrollTop(elemTop);
            } else if ( elemBottom > viewBottom - parent.height()/2 ) {
                parent.scrollTop( elemTop - (parent.height() - $this.height())/2 );
            }
        });
    };

    //Make absolute location
    $.fn.setPositionAbsolute = function(element,offsettop,offsetleft) {
        return this.each(function() {
            // set absolute location for based on the element passed
            // dynamically since every browser has different settings
            var $this = $(this);
            var thiswidth = $(this).width();
            var    pos   = element.offset();
            var    width = element.width();
            var    height = element.height();
            var setleft = (pos.left + width - thiswidth + offsetleft);
            var settop = (pos.top + height + offsettop);
            $this.css({ "z-index" : 1, "position": "absolute", "marginLeft": 0, "marginTop": 0, "left": setleft + "px", "top":settop + "px" ,"width":thiswidth});
            $this.remove().appendTo("body").show();
        });
    };

    $.fn.positionAncestor = function(selector) {
        var left = 0;
        var top = 0;
        this.each(function() {
            // check if current element has an ancestor matching a selector
            // and that ancestor is positioned
            var $ancestor = $(this).closest(selector);
            if ($ancestor.length && $ancestor.css("position") !== "static") {
                var $child = $(this);
                var childMarginEdgeLeft = $child.offset().left - parseInt($child.css("marginLeft"), 10);
                var childMarginEdgeTop = $child.offset().top - parseInt($child.css("marginTop"), 10);
                var ancestorPaddingEdgeLeft = $ancestor.offset().left + parseInt($ancestor.css("borderLeftWidth"), 10);
                var ancestorPaddingEdgeTop = $ancestor.offset().top + parseInt($ancestor.css("borderTopWidth"), 10);
                left = childMarginEdgeLeft - ancestorPaddingEdgeLeft;
                top = childMarginEdgeTop - ancestorPaddingEdgeTop;
                // we have found the ancestor and computed the position
                // stop iterating
                return false;
            }
        });
        return {
            left:    left,
            top:    top
        };
    };


    // XXX: In compat.js we include things for browser compatibility,
    // but these two seem to be only convenience. Do we really want to
    // include these as part of patterns?
    String.prototype.startsWith = function(str) { return (this.match("^"+str) !== null); };
    String.prototype.endsWith = function(str) { return (this.match(str+"$") !== null); };


    /******************************

     Simple Placeholder

     ******************************/

    $.simplePlaceholder = {
        placeholder_class: null,

        hide_placeholder: function(){
            var $this = $(this);
            if($this.val() === $this.attr("placeholder")){
                $this.val("").removeClass($.simplePlaceholder.placeholder_class);
            }
        },

        show_placeholder: function(){
            var $this = $(this);
            if($this.val() === ""){
                $this.val($this.attr("placeholder")).addClass($.simplePlaceholder.placeholder_class);
            }
        },

        prevent_placeholder_submit: function(){
            $(this).find(".simple-placeholder").each(function() {
                var $this = $(this);
                if ($this.val() === $this.attr("placeholder")){
                    $this.val("");
                }
            });
            return true;
        }
    };

    $.fn.simplePlaceholder = function(options) {
        if(document.createElement("input").placeholder === undefined){
            var config = {
                placeholder_class : "placeholding"
            };

            if(options) $.extend(config, options);
            $.simplePlaceholder.placeholder_class = config.placeholder_class;

            this.each(function() {
                var $this = $(this);
                $this.focus($.simplePlaceholder.hide_placeholder);
                $this.blur($.simplePlaceholder.show_placeholder);
                if($this.val() === "") {
                    $this.val($this.attr("placeholder"));
                    $this.addClass($.simplePlaceholder.placeholder_class);
                }
                $this.addClass("simple-placeholder");
                $(this.form).submit($.simplePlaceholder.prevent_placeholder_submit);
            });
        }

        return this;
    };

    $.fn.findInclusive = function(selector) {
        return this.find('*').addBack().filter(selector);
    };

    $.fn.slideIn = function(speed, easing, callback) {
        return this.animate({width: "show"}, speed, easing, callback);
    };

    $.fn.slideOut = function(speed, easing, callback) {
        return this.animate({width: "hide"}, speed, easing, callback);
    };

    // case-insensitive :contains
    $.expr[":"].Contains = function(a, i, m) {
        return $(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
    };
});

/**
 * Patterns registry - Central registry and scan logic for patterns
 *
 * Copyright 2012-2013 Simplon B.V.
 * Copyright 2012-2013 Florian Friesdorf
 * Copyright 2013 Marko Durkovic
 * Copyright 2013 Rok Garbas
 */

/*
 * changes to previous patterns.register/scan mechanism
 * - if you want initialised class, do it in init
 * - init returns set of elements actually initialised
 * - handle once within init
 * - no turnstile anymore
 * - set pattern.jquery_plugin if you want it
 */
define('registry',[
    "jquery",
    "./core/logger",
    "./utils",
    // below here modules that are only loaded
    "./compat",
    "./jquery-ext"
], function($, logger, utils) {
    var log = logger.getLogger("registry"),
        jquery_plugin = utils.jquery_plugin;

    var disable_re = /patterns-disable=([^&]+)/g,
        dont_catch_re = /patterns-dont-catch/g,
        dont_catch = false,
        disabled = {}, match;

    while ((match=disable_re.exec(window.location.search)) !== null) {
        disabled[match[1]] = true;
        log.info('Pattern disabled via url config:', match[1]);
    }

    while ((match=dont_catch_re.exec(window.location.search)) !== null) {
        dont_catch = true;
        log.info('I will not catch init exceptions');
    }

    var registry = {
        patterns: {},
        // as long as the registry is not initialized, pattern
        // registration just registers a pattern. Once init is called,
        // the DOM is scanned. After that registering a new pattern
        // results in rescanning the DOM only for this pattern.
        initialized: false,
        init: function() {
            $(document).ready(function() {
                log.info('loaded: ' + Object.keys(registry.patterns).sort().join(', '));
                registry.scan(document.body);
                registry.initialized = true;
                log.info('finished initial scan.');
            });
        },

        scan: function(content, do_not_catch_init_exception, patterns) {
            var $content = $(content),
                all = [], allsel,
                pattern, $match, plog;

            // If no list of patterns was specified, we scan for all
            // patterns
            patterns = patterns || Object.keys(registry.patterns);

            // selector for all patterns
            patterns.forEach(function(name) {
                if (disabled[name]) {
                    log.debug('Skipping disabled pattern:', name);
                    return;
                }
                pattern = registry.patterns[name];
                if (pattern.transform) {
                    if (do_not_catch_init_exception || dont_catch) {
                        pattern.transform($content);
                    } else {
                        try {
                            pattern.transform($content);
                        } catch (e) {
                            log.error("Transform error for pattern" + name, e);
                        }
                    }
                }
                if (pattern.trigger) {
                    all.push(pattern.trigger);
                }
            });
            allsel = all.join(",");

            // Find all elements that belong to any pattern.
            $match = $content.findInclusive(allsel);
            $match = $match.filter(function() { return $(this).parents('pre').length === 0; });
            $match = $match.filter(":not(.cant-touch-this)");

            // walk list backwards and initialize patterns inside-out.
            //
            // XXX: If patterns would only trigger via classes, we
            // could iterate over an element classes and trigger
            // patterns in order.
            //
            // Advantages: Order of pattern initialization controled
            // via order of pat-classes and more efficient.
            $match.toArray().reduceRight(function(acc, el) {
                var $el = $(el);

                for (var name in registry.patterns) {
                    pattern = registry.patterns[name];
                    if (pattern.init) {
                        plog = logger.getLogger("pat." + name);

                        if ($el.is(pattern.trigger)) {
                            plog.debug("Initialising:", $el);
                            if (do_not_catch_init_exception || dont_catch) {
                                pattern.init($el);
                                plog.debug("done.");
                            } else {
                                try {
                                    pattern.init($el);
                                    plog.debug("done.");
                                } catch (e) {
                                    plog.error("Caught error:", e);
                                }
                            }
                        }
                    }
                }
            }, null);
        },

        // XXX: differentiate between internal and custom patterns
        // _register vs register
        register: function(pattern) {
            if (!pattern.name) {
                log.error("Pattern lacks name:", pattern);
                return false;
            }

            if (registry.patterns[pattern.name]) {
                log.error("Already have a pattern called: " + pattern.name);
                return false;
            }

            // register pattern to be used for scanning new content
            registry.patterns[pattern.name] = pattern;

            // register pattern as jquery plugin
            if (pattern.jquery_plugin) {
                var pluginName = ("pat-" + pattern.name)
                        .replace(/-([a-zA-Z])/g, function(match, p1) {
                            return p1.toUpperCase();
                        });
                $.fn[pluginName] = jquery_plugin(pattern);
                // BBB 2012-12-10
                $.fn[pluginName.replace(/^pat/, "pattern")] = jquery_plugin(pattern);
            }

            log.debug("Registered pattern:", pattern.name, pattern);

            if (registry.initialized) {
                registry.scan(document.body, false, [pattern.name]);
            }
            return true;
        }
    };

    $(document) .on("patterns-injected.patterns", function(ev) {
        registry.scan(ev.target);
        $(ev.target).trigger("patterns-injected-scanned");
    });

    return registry;
});
// jshint indent: 4, browser: true, jquery: true, quotmark: double
// vim: sw=4 expandtab
;
define('jquery.form/jquery.form',['jquery'], function($) {
/*!
 * jQuery Form Plugin
 * version: 3.27.0-2013.02.06
 * @requires jQuery v1.5 or later
 *
 * Examples and documentation at: http://malsup.com/jquery/form/
 * Project repository: https://github.com/malsup/form
 * Dual licensed under the MIT and GPL licenses:
 *    http://malsup.github.com/mit-license.txt
 *    http://malsup.github.com/gpl-license-v2.txt
 */
/*global ActiveXObject alert */
;(function($) {


/*
    Usage Note:
    -----------
    Do not use both ajaxSubmit and ajaxForm on the same form.  These
    functions are mutually exclusive.  Use ajaxSubmit if you want
    to bind your own submit handler to the form.  For example,

    $(document).ready(function() {
        $('#myForm').on('submit', function(e) {
            e.preventDefault(); // <-- important
            $(this).ajaxSubmit({
                target: '#output'
            });
        });
    });

    Use ajaxForm when you want the plugin to manage all the event binding
    for you.  For example,

    $(document).ready(function() {
        $('#myForm').ajaxForm({
            target: '#output'
        });
    });

    You can also use ajaxForm with delegation (requires jQuery v1.7+), so the
    form does not have to exist when you invoke ajaxForm:

    $('#myForm').ajaxForm({
        delegation: true,
        target: '#output'
    });

    When using ajaxForm, the ajaxSubmit function will be invoked for you
    at the appropriate time.
*/

/**
 * Feature detection
 */
var feature = {};
feature.fileapi = $("<input type='file'/>").get(0).files !== undefined;
feature.formdata = window.FormData !== undefined;

/**
 * ajaxSubmit() provides a mechanism for immediately submitting
 * an HTML form using AJAX.
 */
$.fn.ajaxSubmit = function(options) {
    /*jshint scripturl:true */

    // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
    if (!this.length) {
        log('ajaxSubmit: skipping submit process - no element selected');
        return this;
    }

    var method, action, url, $form = this;

    if (typeof options == 'function') {
        options = { success: options };
    }

    method = this.attr('method');
    action = this.attr('action');
    url = (typeof action === 'string') ? $.trim(action) : '';
    url = url || window.location.href || '';
    if (url) {
        // clean url (don't include hash vaue)
        url = (url.match(/^([^#]+)/)||[])[1];
    }

    options = $.extend(true, {
        url:  url,
        success: $.ajaxSettings.success,
        type: method || 'GET',
        iframeSrc: /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank'
    }, options);

    // hook for manipulating the form data before it is extracted;
    // convenient for use with rich editors like tinyMCE or FCKEditor
    var veto = {};
    this.trigger('form-pre-serialize', [this, options, veto]);
    if (veto.veto) {
        log('ajaxSubmit: submit vetoed via form-pre-serialize trigger');
        return this;
    }

    // provide opportunity to alter form data before it is serialized
    if (options.beforeSerialize && options.beforeSerialize(this, options) === false) {
        log('ajaxSubmit: submit aborted via beforeSerialize callback');
        return this;
    }

    var traditional = options.traditional;
    if ( traditional === undefined ) {
        traditional = $.ajaxSettings.traditional;
    }

    var elements = [];
    var qx, a = this.formToArray(options.semantic, elements);
    if (options.data) {
        options.extraData = options.data;
        qx = $.param(options.data, traditional);
    }

    // give pre-submit callback an opportunity to abort the submit
    if (options.beforeSubmit && options.beforeSubmit(a, this, options) === false) {
        log('ajaxSubmit: submit aborted via beforeSubmit callback');
        return this;
    }

    // fire vetoable 'validate' event
    this.trigger('form-submit-validate', [a, this, options, veto]);
    if (veto.veto) {
        log('ajaxSubmit: submit vetoed via form-submit-validate trigger');
        return this;
    }

    var q = $.param(a, traditional);
    if (qx) {
        q = ( q ? (q + '&' + qx) : qx );
    }
    if (options.type.toUpperCase() == 'GET') {
        options.url += (options.url.indexOf('?') >= 0 ? '&' : '?') + q;
        options.data = null;  // data is null for 'get'
    }
    else {
        options.data = q; // data is the query string for 'post'
    }

    var callbacks = [];
    if (options.resetForm) {
        callbacks.push(function() { $form.resetForm(); });
    }
    if (options.clearForm) {
        callbacks.push(function() { $form.clearForm(options.includeHidden); });
    }

    // perform a load on the target only if dataType is not provided
    if (!options.dataType && options.target) {
        var oldSuccess = options.success || function(){};
        callbacks.push(function(data) {
            var fn = options.replaceTarget ? 'replaceWith' : 'html';
            $(options.target)[fn](data).each(oldSuccess, arguments);
        });
    }
    else if (options.success) {
        callbacks.push(options.success);
    }

    options.success = function(data, status, xhr) { // jQuery 1.4+ passes xhr as 3rd arg
        var context = options.context || this ;    // jQuery 1.4+ supports scope context
        for (var i=0, max=callbacks.length; i < max; i++) {
            callbacks[i].apply(context, [data, status, xhr || $form, $form]);
        }
    };

    // are there files to upload?

    // [value] (issue #113), also see comment:
    // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
    var fileInputs = $('input[type=file]:enabled[value!=""]', this);

    var hasFileInputs = fileInputs.length > 0;
    var mp = 'multipart/form-data';
    var multipart = ($form.attr('enctype') == mp || $form.attr('encoding') == mp);

    var fileAPI = feature.fileapi && feature.formdata;
    log("fileAPI :" + fileAPI);
    var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

    var jqxhr;

    // options.iframe allows user to force iframe mode
    // 06-NOV-09: now defaulting to iframe mode if file input is detected
    if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
        // hack to fix Safari hang (thanks to Tim Molendijk for this)
        // see:  http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
        if (options.closeKeepAlive) {
            $.get(options.closeKeepAlive, function() {
                jqxhr = fileUploadIframe(a);
            });
        }
        else {
            jqxhr = fileUploadIframe(a);
        }
    }
    else if ((hasFileInputs || multipart) && fileAPI) {
        jqxhr = fileUploadXhr(a);
    }
    else {
        jqxhr = $.ajax(options);
    }

    $form.removeData('jqxhr').data('jqxhr', jqxhr);

    // clear element array
    for (var k=0; k < elements.length; k++)
        elements[k] = null;

    // fire 'notify' event
    this.trigger('form-submit-notify', [this, options]);
    return this;

    // utility fn for deep serialization
    function deepSerialize(extraData){
        var serialized = $.param(extraData).split('&');
        var len = serialized.length;
        var result = [];
        var i, part;
        for (i=0; i < len; i++) {
            // #252; undo param space replacement
            serialized[i] = serialized[i].replace(/\+/g,' ');
            part = serialized[i].split('=');
            // #278; use array instead of object storage, favoring array serializations
            result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
        }
        return result;
    }

     // XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
    function fileUploadXhr(a) {
        var formdata = new FormData();

        for (var i=0; i < a.length; i++) {
            formdata.append(a[i].name, a[i].value);
        }

        if (options.extraData) {
            var serializedData = deepSerialize(options.extraData);
            for (i=0; i < serializedData.length; i++)
                if (serializedData[i])
                    formdata.append(serializedData[i][0], serializedData[i][1]);
        }

        options.data = null;

        var s = $.extend(true, {}, $.ajaxSettings, options, {
            contentType: false,
            processData: false,
            cache: false,
            type: method || 'POST'
        });

        if (options.uploadProgress) {
            // workaround because jqXHR does not expose upload property
            s.xhr = function() {
                var xhr = jQuery.ajaxSettings.xhr();
                if (xhr.upload) {
                    xhr.upload.addEventListener('progress', function(event) {
                        var percent = 0;
                        var position = event.loaded || event.position; /*event.position is deprecated*/
                        var total = event.total;
                        if (event.lengthComputable) {
                            percent = Math.ceil(position / total * 100);
                        }
                        options.uploadProgress(event, position, total, percent);
                    }, false);
                }
                return xhr;
            };
        }

        s.data = null;
            var beforeSend = s.beforeSend;
            s.beforeSend = function(xhr, o) {
                o.data = formdata;
                if(beforeSend)
                    beforeSend.call(this, xhr, o);
        };
        return $.ajax(s);
    }

    // private function for handling file uploads (hat tip to YAHOO!)
    function fileUploadIframe(a) {
        var form = $form[0], el, i, s, g, id, $io, io, xhr, sub, n, timedOut, timeoutHandle;
        var useProp = !!$.fn.prop;
        var deferred = $.Deferred();

        if (a) {
            // ensure that every serialized input is still enabled
            for (i=0; i < elements.length; i++) {
                el = $(elements[i]);
                if ( useProp )
                    el.prop('disabled', false);
                else
                    el.removeAttr('disabled');
            }
        }

        s = $.extend(true, {}, $.ajaxSettings, options);
        s.context = s.context || s;
        id = 'jqFormIO' + (new Date().getTime());
        if (s.iframeTarget) {
            $io = $(s.iframeTarget);
            n = $io.attr('name');
            if (!n)
                 $io.attr('name', id);
            else
                id = n;
        }
        else {
            $io = $('<iframe name="' + id + '" src="'+ s.iframeSrc +'" />');
            $io.css({ position: 'absolute', top: '-1000px', left: '-1000px' });
        }
        io = $io[0];


        xhr = { // mock object
            aborted: 0,
            responseText: null,
            responseXML: null,
            status: 0,
            statusText: 'n/a',
            getAllResponseHeaders: function() {},
            getResponseHeader: function() {},
            setRequestHeader: function() {},
            abort: function(status) {
                var e = (status === 'timeout' ? 'timeout' : 'aborted');
                log('aborting upload... ' + e);
                this.aborted = 1;

                try { // #214, #257
                    if (io.contentWindow.document.execCommand) {
                        io.contentWindow.document.execCommand('Stop');
                    }
                }
                catch(ignore) {}

                $io.attr('src', s.iframeSrc); // abort op in progress
                xhr.error = e;
                if (s.error)
                    s.error.call(s.context, xhr, e, status);
                if (g)
                    $.event.trigger("ajaxError", [xhr, s, e]);
                if (s.complete)
                    s.complete.call(s.context, xhr, e);
            }
        };

        g = s.global;
        // trigger ajax global events so that activity/block indicators work like normal
        if (g && 0 === $.active++) {
            $.event.trigger("ajaxStart");
        }
        if (g) {
            $.event.trigger("ajaxSend", [xhr, s]);
        }

        if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
            if (s.global) {
                $.active--;
            }
            deferred.reject();
            return deferred;
        }
        if (xhr.aborted) {
            deferred.reject();
            return deferred;
        }

        // add submitting element to data if we know it
        sub = form.clk;
        if (sub) {
            n = sub.name;
            if (n && !sub.disabled) {
                s.extraData = s.extraData || {};
                s.extraData[n] = sub.value;
                if (sub.type == "image") {
                    s.extraData[n+'.x'] = form.clk_x;
                    s.extraData[n+'.y'] = form.clk_y;
                }
            }
        }

        var CLIENT_TIMEOUT_ABORT = 1;
        var SERVER_ABORT = 2;

        function getDoc(frame) {
            var doc = frame.contentWindow ? frame.contentWindow.document : frame.contentDocument ? frame.contentDocument : frame.document;
            return doc;
        }

        // Rails CSRF hack (thanks to Yvan Barthelemy)
        var csrf_token = $('meta[name=csrf-token]').attr('content');
        var csrf_param = $('meta[name=csrf-param]').attr('content');
        if (csrf_param && csrf_token) {
            s.extraData = s.extraData || {};
            s.extraData[csrf_param] = csrf_token;
        }

        // take a breath so that pending repaints get some cpu time before the upload starts
        function doSubmit() {
            // make sure form attrs are set
            var t = $form.attr('target'), a = $form.attr('action');

            // update form attrs in IE friendly way
            form.setAttribute('target',id);
            if (!method) {
                form.setAttribute('method', 'POST');
            }
            if (a != s.url) {
                form.setAttribute('action', s.url);
            }

            // ie borks in some cases when setting encoding
            if (! s.skipEncodingOverride && (!method || /post/i.test(method))) {
                $form.attr({
                    encoding: 'multipart/form-data',
                    enctype:  'multipart/form-data'
                });
            }

            // support timout
            if (s.timeout) {
                timeoutHandle = setTimeout(function() { timedOut = true; cb(CLIENT_TIMEOUT_ABORT); }, s.timeout);
            }

            // look for server aborts
            function checkState() {
                try {
                    var state = getDoc(io).readyState;
                    log('state = ' + state);
                    if (state && state.toLowerCase() == 'uninitialized')
                        setTimeout(checkState,50);
                }
                catch(e) {
                    log('Server abort: ' , e, ' (', e.name, ')');
                    cb(SERVER_ABORT);
                    if (timeoutHandle)
                        clearTimeout(timeoutHandle);
                    timeoutHandle = undefined;
                }
            }

            // add "extra" data to form if provided in options
            var extraInputs = [];
            try {
                if (s.extraData) {
                    for (var n in s.extraData) {
                        if (s.extraData.hasOwnProperty(n)) {
                           // if using the $.param format that allows for multiple values with the same name
                           if($.isPlainObject(s.extraData[n]) && s.extraData[n].hasOwnProperty('name') && s.extraData[n].hasOwnProperty('value')) {
                               extraInputs.push(
                               $('<input type="hidden" name="'+s.extraData[n].name+'">').val(s.extraData[n].value)
                                   .appendTo(form)[0]);
                           } else {
                               extraInputs.push(
                               $('<input type="hidden" name="'+n+'">').val(s.extraData[n])
                                   .appendTo(form)[0]);
                           }
                        }
                    }
                }

                if (!s.iframeTarget) {
                    // add iframe to doc and submit the form
                    $io.appendTo('body');
                    if (io.attachEvent)
                        io.attachEvent('onload', cb);
                    else
                        io.addEventListener('load', cb, false);
                }
                setTimeout(checkState,15);
                // just in case form has element with name/id of 'submit'
                var submitFn = document.createElement('form').submit;
                submitFn.apply(form);
            }
            finally {
                // reset attrs and remove "extra" input elements
                form.setAttribute('action',a);
                if(t) {
                    form.setAttribute('target', t);
                } else {
                    $form.removeAttr('target');
                }
                $(extraInputs).remove();
            }
        }

        if (s.forceSync) {
            doSubmit();
        }
        else {
            setTimeout(doSubmit, 10); // this lets dom updates render
        }

        var data, doc, domCheckCount = 50, callbackProcessed;

        function cb(e) {
            if (xhr.aborted || callbackProcessed) {
                return;
            }
            try {
                doc = getDoc(io);
            }
            catch(ex) {
                log('cannot access response document: ', ex);
                e = SERVER_ABORT;
            }
            if (e === CLIENT_TIMEOUT_ABORT && xhr) {
                xhr.abort('timeout');
                deferred.reject(xhr, 'timeout');
                return;
            }
            else if (e == SERVER_ABORT && xhr) {
                xhr.abort('server abort');
                deferred.reject(xhr, 'error', 'server abort');
                return;
            }

            if (!doc || doc.location.href == s.iframeSrc) {
                // response not received yet
                if (!timedOut)
                    return;
            }
            if (io.detachEvent)
                io.detachEvent('onload', cb);
            else
                io.removeEventListener('load', cb, false);

            var status = 'success', errMsg;
            try {
                if (timedOut) {
                    throw 'timeout';
                }

                var isXml = s.dataType == 'xml' || doc.XMLDocument || $.isXMLDoc(doc);
                log('isXml='+isXml);
                if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
                    if (--domCheckCount) {
                        // in some browsers (Opera) the iframe DOM is not always traversable when
                        // the onload callback fires, so we loop a bit to accommodate
                        log('requeing onLoad callback, DOM not available');
                        setTimeout(cb, 250);
                        return;
                    }
                    // let this fall through because server response could be an empty document
                    //log('Could not access iframe DOM after mutiple tries.');
                    //throw 'DOMException: not available';
                }

                //log('response detected');
                var docRoot = doc.body ? doc.body : doc.documentElement;
                xhr.responseText = docRoot ? docRoot.innerHTML : null;
                xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
                if (isXml)
                    s.dataType = 'xml';
                xhr.getResponseHeader = function(header){
                    var headers = {'content-type': s.dataType};
                    return headers[header];
                };
                // support for XHR 'status' & 'statusText' emulation :
                if (docRoot) {
                    xhr.status = Number( docRoot.getAttribute('status') ) || xhr.status;
                    xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
                }

                var dt = (s.dataType || '').toLowerCase();
                var scr = /(json|script|text)/.test(dt);
                if (scr || s.textarea) {
                    // see if user embedded response in textarea
                    var ta = doc.getElementsByTagName('textarea')[0];
                    if (ta) {
                        xhr.responseText = ta.value;
                        // support for XHR 'status' & 'statusText' emulation :
                        xhr.status = Number( ta.getAttribute('status') ) || xhr.status;
                        xhr.statusText = ta.getAttribute('statusText') || xhr.statusText;
                    }
                    else if (scr) {
                        // account for browsers injecting pre around json response
                        var pre = doc.getElementsByTagName('pre')[0];
                        var b = doc.getElementsByTagName('body')[0];
                        if (pre) {
                            xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
                        }
                        else if (b) {
                            xhr.responseText = b.textContent ? b.textContent : b.innerText;
                        }
                    }
                }
                else if (dt == 'xml' && !xhr.responseXML && xhr.responseText) {
                    xhr.responseXML = toXml(xhr.responseText);
                }

                try {
                    data = httpData(xhr, dt, s);
                }
                catch (e) {
                    status = 'parsererror';
                    xhr.error = errMsg = (e || status);
                }
            }
            catch (e) {
                log('error caught: ',e);
                status = 'error';
                xhr.error = errMsg = (e || status);
            }

            if (xhr.aborted) {
                log('upload aborted');
                status = null;
            }

            if (xhr.status) { // we've set xhr.status
                status = (xhr.status >= 200 && xhr.status < 300 || xhr.status === 304) ? 'success' : 'error';
            }

            // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
            if (status === 'success') {
                if (s.success)
                    s.success.call(s.context, data, 'success', xhr);
                deferred.resolve(xhr.responseText, 'success', xhr);
                if (g)
                    $.event.trigger("ajaxSuccess", [xhr, s]);
            }
            else if (status) {
                if (errMsg === undefined)
                    errMsg = xhr.statusText;
                if (s.error)
                    s.error.call(s.context, xhr, status, errMsg);
                deferred.reject(xhr, 'error', errMsg);
                if (g)
                    $.event.trigger("ajaxError", [xhr, s, errMsg]);
            }

            if (g)
                $.event.trigger("ajaxComplete", [xhr, s]);

            if (g && ! --$.active) {
                $.event.trigger("ajaxStop");
            }

            if (s.complete)
                s.complete.call(s.context, xhr, status);

            callbackProcessed = true;
            if (s.timeout)
                clearTimeout(timeoutHandle);

            // clean up
            setTimeout(function() {
                if (!s.iframeTarget)
                    $io.remove();
                xhr.responseXML = null;
            }, 100);
        }

        var toXml = $.parseXML || function(s, doc) { // use parseXML if available (jQuery 1.5+)
            if (window.ActiveXObject) {
                doc = new ActiveXObject('Microsoft.XMLDOM');
                doc.async = 'false';
                doc.loadXML(s);
            }
            else {
                doc = (new DOMParser()).parseFromString(s, 'text/xml');
            }
            return (doc && doc.documentElement && doc.documentElement.nodeName != 'parsererror') ? doc : null;
        };
        var parseJSON = $.parseJSON || function(s) {
            /*jslint evil:true */
            return window['eval']('(' + s + ')');
        };

        var httpData = function( xhr, type, s ) { // mostly lifted from jq1.4.4

            var ct = xhr.getResponseHeader('content-type') || '',
                xml = type === 'xml' || !type && ct.indexOf('xml') >= 0,
                data = xml ? xhr.responseXML : xhr.responseText;

            if (xml && data.documentElement.nodeName === 'parsererror') {
                if ($.error)
                    $.error('parsererror');
            }
            if (s && s.dataFilter) {
                data = s.dataFilter(data, type);
            }
            if (typeof data === 'string') {
                if (type === 'json' || !type && ct.indexOf('json') >= 0) {
                    data = parseJSON(data);
                } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                    $.globalEval(data);
                }
            }
            return data;
        };

        return deferred;
    }
};

/**
 * ajaxForm() provides a mechanism for fully automating form submission.
 *
 * The advantages of using this method instead of ajaxSubmit() are:
 *
 * 1: This method will include coordinates for <input type="image" /> elements (if the element
 *    is used to submit the form).
 * 2. This method will include the submit element's name/value data (for the element that was
 *    used to submit the form).
 * 3. This method binds the submit() method to the form for you.
 *
 * The options argument for ajaxForm works exactly as it does for ajaxSubmit.  ajaxForm merely
 * passes the options argument along after properly binding events for submit elements and
 * the form itself.
 */
$.fn.ajaxForm = function(options) {
    options = options || {};
    options.delegation = options.delegation && $.isFunction($.fn.on);

    // in jQuery 1.3+ we can fix mistakes with the ready state
    if (!options.delegation && this.length === 0) {
        var o = { s: this.selector, c: this.context };
        if (!$.isReady && o.s) {
            log('DOM not ready, queuing ajaxForm');
            $(function() {
                $(o.s,o.c).ajaxForm(options);
            });
            return this;
        }
        // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
        log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
        return this;
    }

    if ( options.delegation ) {
        $(document)
            .off('submit.form-plugin', this.selector, doAjaxSubmit)
            .off('click.form-plugin', this.selector, captureSubmittingElement)
            .on('submit.form-plugin', this.selector, options, doAjaxSubmit)
            .on('click.form-plugin', this.selector, options, captureSubmittingElement);
        return this;
    }

    return this.ajaxFormUnbind()
        .bind('submit.form-plugin', options, doAjaxSubmit)
        .bind('click.form-plugin', options, captureSubmittingElement);
};

// private event handlers
function doAjaxSubmit(e) {
    /*jshint validthis:true */
    var options = e.data;
    if (!e.isDefaultPrevented()) { // if event has been canceled, don't proceed
        e.preventDefault();
        $(this).ajaxSubmit(options);
    }
}

function captureSubmittingElement(e) {
    /*jshint validthis:true */
    var target = e.target;
    var $el = $(target);
    if (!($el.is("[type=submit],[type=image]"))) {
        // is this a child element of the submit el?  (ex: a span within a button)
        var t = $el.closest('[type=submit]');
        if (t.length === 0) {
            return;
        }
        target = t[0];
    }
    var form = this;
    form.clk = target;
    if (target.type == 'image') {
        if (e.offsetX !== undefined) {
            form.clk_x = e.offsetX;
            form.clk_y = e.offsetY;
        } else if (typeof $.fn.offset == 'function') {
            var offset = $el.offset();
            form.clk_x = e.pageX - offset.left;
            form.clk_y = e.pageY - offset.top;
        } else {
            form.clk_x = e.pageX - target.offsetLeft;
            form.clk_y = e.pageY - target.offsetTop;
        }
    }
    // clear form vars
    setTimeout(function() { form.clk = form.clk_x = form.clk_y = null; }, 100);
}


// ajaxFormUnbind unbinds the event handlers that were bound by ajaxForm
$.fn.ajaxFormUnbind = function() {
    return this.unbind('submit.form-plugin click.form-plugin');
};

/**
 * formToArray() gathers form element data into an array of objects that can
 * be passed to any of the following ajax functions: $.get, $.post, or load.
 * Each object in the array has both a 'name' and 'value' property.  An example of
 * an array for a simple login form might be:
 *
 * [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
 *
 * It is this array that is passed to pre-submit callback functions provided to the
 * ajaxSubmit() and ajaxForm() methods.
 */
$.fn.formToArray = function(semantic, elements) {
    var a = [];
    if (this.length === 0) {
        return a;
    }

    var form = this[0];
    var els = semantic ? form.getElementsByTagName('*') : form.elements;
    if (!els) {
        return a;
    }

    var i,j,n,v,el,max,jmax;
    for(i=0, max=els.length; i < max; i++) {
        el = els[i];
        n = el.name;
        if (!n) {
            continue;
        }

        if (semantic && form.clk && el.type == "image") {
            // handle image inputs on the fly when semantic == true
            if(!el.disabled && form.clk == el) {
                a.push({name: n, value: $(el).val(), type: el.type });
                a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
            }
            continue;
        }

        v = $.fieldValue(el, true);
        if (v && v.constructor == Array) {
            if (elements)
                elements.push(el);
            for(j=0, jmax=v.length; j < jmax; j++) {
                a.push({name: n, value: v[j]});
            }
        }
        else if (feature.fileapi && el.type == 'file' && !el.disabled) {
            if (elements)
                elements.push(el);
            var files = el.files;
            if (files.length) {
                for (j=0; j < files.length; j++) {
                    a.push({name: n, value: files[j], type: el.type});
                }
            }
            else {
                // #180
                a.push({ name: n, value: '', type: el.type });
            }
        }
        else if (v !== null && typeof v != 'undefined') {
            if (elements)
                elements.push(el);
            a.push({name: n, value: v, type: el.type, required: el.required});
        }
    }

    if (!semantic && form.clk) {
        // input type=='image' are not found in elements array! handle it here
        var $input = $(form.clk), input = $input[0];
        n = input.name;
        if (n && !input.disabled && input.type == 'image') {
            a.push({name: n, value: $input.val()});
            a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
        }
    }
    return a;
};

/**
 * Serializes form data into a 'submittable' string. This method will return a string
 * in the format: name1=value1&amp;name2=value2
 */
$.fn.formSerialize = function(semantic) {
    //hand off to jQuery.param for proper encoding
    return $.param(this.formToArray(semantic));
};

/**
 * Serializes all field elements in the jQuery object into a query string.
 * This method will return a string in the format: name1=value1&amp;name2=value2
 */
$.fn.fieldSerialize = function(successful) {
    var a = [];
    this.each(function() {
        var n = this.name;
        if (!n) {
            return;
        }
        var v = $.fieldValue(this, successful);
        if (v && v.constructor == Array) {
            for (var i=0,max=v.length; i < max; i++) {
                a.push({name: n, value: v[i]});
            }
        }
        else if (v !== null && typeof v != 'undefined') {
            a.push({name: this.name, value: v});
        }
    });
    //hand off to jQuery.param for proper encoding
    return $.param(a);
};

/**
 * Returns the value(s) of the element in the matched set.  For example, consider the following form:
 *
 *  <form><fieldset>
 *      <input name="A" type="text" />
 *      <input name="A" type="text" />
 *      <input name="B" type="checkbox" value="B1" />
 *      <input name="B" type="checkbox" value="B2"/>
 *      <input name="C" type="radio" value="C1" />
 *      <input name="C" type="radio" value="C2" />
 *  </fieldset></form>
 *
 *  var v = $('input[type=text]').fieldValue();
 *  // if no values are entered into the text inputs
 *  v == ['','']
 *  // if values entered into the text inputs are 'foo' and 'bar'
 *  v == ['foo','bar']
 *
 *  var v = $('input[type=checkbox]').fieldValue();
 *  // if neither checkbox is checked
 *  v === undefined
 *  // if both checkboxes are checked
 *  v == ['B1', 'B2']
 *
 *  var v = $('input[type=radio]').fieldValue();
 *  // if neither radio is checked
 *  v === undefined
 *  // if first radio is checked
 *  v == ['C1']
 *
 * The successful argument controls whether or not the field element must be 'successful'
 * (per http://www.w3.org/TR/html4/interact/forms.html#successful-controls).
 * The default value of the successful argument is true.  If this value is false the value(s)
 * for each element is returned.
 *
 * Note: This method *always* returns an array.  If no valid value can be determined the
 *    array will be empty, otherwise it will contain one or more values.
 */
$.fn.fieldValue = function(successful) {
    for (var val=[], i=0, max=this.length; i < max; i++) {
        var el = this[i];
        var v = $.fieldValue(el, successful);
        if (v === null || typeof v == 'undefined' || (v.constructor == Array && !v.length)) {
            continue;
        }
        if (v.constructor == Array)
            $.merge(val, v);
        else
            val.push(v);
    }
    return val;
};

/**
 * Returns the value of the field element.
 */
$.fieldValue = function(el, successful) {
    var n = el.name, t = el.type, tag = el.tagName.toLowerCase();
    if (successful === undefined) {
        successful = true;
    }

    if (successful && (!n || el.disabled || t == 'reset' || t == 'button' ||
        (t == 'checkbox' || t == 'radio') && !el.checked ||
        (t == 'submit' || t == 'image') && el.form && el.form.clk != el ||
        tag == 'select' && el.selectedIndex == -1)) {
            return null;
    }

    if (tag == 'select') {
        var index = el.selectedIndex;
        if (index < 0) {
            return null;
        }
        var a = [], ops = el.options;
        var one = (t == 'select-one');
        var max = (one ? index+1 : ops.length);
        for(var i=(one ? index : 0); i < max; i++) {
            var op = ops[i];
            if (op.selected) {
                var v = op.value;
                if (!v) { // extra pain for IE...
                    v = (op.attributes && op.attributes['value'] && !(op.attributes['value'].specified)) ? op.text : op.value;
                }
                if (one) {
                    return v;
                }
                a.push(v);
            }
        }
        return a;
    }
    return $(el).val();
};

/**
 * Clears the form data.  Takes the following actions on the form's input fields:
 *  - input text fields will have their 'value' property set to the empty string
 *  - select elements will have their 'selectedIndex' property set to -1
 *  - checkbox and radio inputs will have their 'checked' property set to false
 *  - inputs of type submit, button, reset, and hidden will *not* be effected
 *  - button elements will *not* be effected
 */
$.fn.clearForm = function(includeHidden) {
    return this.each(function() {
        $('input,select,textarea', this).clearFields(includeHidden);
    });
};

/**
 * Clears the selected form elements.
 */
$.fn.clearFields = $.fn.clearInputs = function(includeHidden) {
    var re = /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list
    return this.each(function() {
        var t = this.type, tag = this.tagName.toLowerCase();
        if (re.test(t) || tag == 'textarea') {
            this.value = '';
        }
        else if (t == 'checkbox' || t == 'radio') {
            this.checked = false;
        }
        else if (tag == 'select') {
            this.selectedIndex = -1;
        }
        else if (t == "file") {
            if (/MSIE/.test(navigator.userAgent)) {
                $(this).replaceWith($(this).clone());
            } else {
                $(this).val('');
            }
        }
        else if (includeHidden) {
            // includeHidden can be the value true, or it can be a selector string
            // indicating a special test; for example:
            //  $('#myForm').clearForm('.special:hidden')
            // the above would clean hidden inputs that have the class of 'special'
            if ( (includeHidden === true && /hidden/.test(t)) ||
                 (typeof includeHidden == 'string' && $(this).is(includeHidden)) )
                this.value = '';
        }
    });
};

/**
 * Resets the form data.  Causes all form elements to be reset to their original value.
 */
$.fn.resetForm = function() {
    return this.each(function() {
        // guard against an input with the name of 'reset'
        // note that IE reports the reset function as an 'object'
        if (typeof this.reset == 'function' || (typeof this.reset == 'object' && !this.reset.nodeType)) {
            this.reset();
        }
    });
};

/**
 * Enables or disables any matching elements.
 */
$.fn.enable = function(b) {
    if (b === undefined) {
        b = true;
    }
    return this.each(function() {
        this.disabled = !b;
    });
};

/**
 * Checks/unchecks any matching checkboxes or radio buttons and
 * selects/deselects and matching option elements.
 */
$.fn.selected = function(select) {
    if (select === undefined) {
        select = true;
    }
    return this.each(function() {
        var t = this.type;
        if (t == 'checkbox' || t == 'radio') {
            this.checked = select;
        }
        else if (this.tagName.toLowerCase() == 'option') {
            var $sel = $(this).parent('select');
            if (select && $sel[0] && $sel[0].type == 'select-one') {
                // deselect all other options
                $sel.find('option').selected(false);
            }
            this.selected = select;
        }
    });
};

// expose debug var
$.fn.ajaxSubmit.debug = false;

// helper fn for console logging
function log() {
    if (!$.fn.ajaxSubmit.debug)
        return;
    var msg = '[jquery.form] ' + Array.prototype.join.call(arguments,'');
    if (window.console && window.console.log) {
        window.console.log(msg);
    }
    else if (window.opera && window.opera.postError) {
        window.opera.postError(msg);
    }
}

})(jQuery);

});
define('jquery.form', ['jquery.form/jquery.form'], function (main) { return main; });

/**
 * Patterns ajax - AJAX injection for forms and anchors
 *
 * Copyright 2012-2013 Florian Friesdorf
 * Copyright 2012-2013 Marko Durkovic
 */
define('pat/ajax',[
    "jquery",
    "../core/logger",
    "../core/parser",
    "../registry",
    "jquery.form"
], function($, logger, Parser, registry) {
    var log = logger.getLogger('pat.ajax'),
        parser = new Parser('ajax');

    parser.add_argument('url', function($el) {
        return ($el.is('a') ? $el.attr('href') :
                ($el.is('form') ? $el.attr('action') : '')).split('#')[0];
    });

    var _ = {
        name: "ajax",
        trigger: ".pat-ajax",
        parser: parser,
        init: function($el) {
            $el.off('.pat-ajax');
            $el.filter('a').on('click.pat-ajax', _.onTriggerEvents);
            $el.filter('form')
                .on('submit.pat-ajax', _.onTriggerEvents)
                .on('click.pat-ajax', '[type=submit]', _.onClickSubmit);
            $el.filter(':not(form,a)').each(function() {
                log.warn('Unsupported element:', this);
            });
            return $el;
        },
        destroy: function($el) {
            $el.off('.pat-ajax');
        },
        onClickSubmit: function(event) {
            var $form = $(event.target).parents('form').first(),
                name = event.target.name,
                value = $(event.target).val(),
                data = {};
            if (name) {
                data[name] = value;
            }
            $form.data('pat-ajax.clicked-data', data);
        },
        onTriggerEvents: function(event) {
            if (event) {
                event.preventDefault();
            }
            _.request($(this));
        },
        request: function($el, opts) {
            return $el.each(function() {
                _._request($(this), opts);
            });
        },
        _request: function($el, opts) {
            var cfg = _.parser.parse($el, opts),
                onError = function(jqxhr, status, error) {
                    // error can also stem from a javascript
                    // exception, not only errors described in the
                    // jqxhr.
                    log.error("load error for " + cfg.url + ":", error, jqxhr);
                    $el.trigger({
                        type: "pat-ajax-error",
                        error: error,
                        jqxhr: jqxhr
                    });
                },
                onSuccess = function(data, status, jqxhr) {
                    log.debug("success: jqxhr:", jqxhr);
                    $el.trigger({
                        type: "pat-ajax-success",
                        jqxhr: jqxhr
                    });
                },
                args = {
                    context: $el,
                    data: $el.data('pat-ajax.clicked-data'),
                    url: cfg.url,
                    error: onError,
                    success: onSuccess
                };

            $el.removeData('pat-ajax.clicked-data');
            log.debug('request:', args, $el[0]);
            if ($el.is('form')) {
                $el.ajaxSubmit(args);
            } else {
                $.ajax(args);
            }
        }
    };

    registry.register(_);
    return _;
});

/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * Modified by Wichert Akkerman to support act as a module and handle new
 * HTML5 elements.
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * // or to get an XML string:
 * HTMLtoXML(htmlString);
 *
 * // or to get an XML DOM Document
 * HTMLtoDOM(htmlString);
 *
 * // or to inject into an existing document/DOM node
 * HTMLtoDOM(htmlString, document);
 * HTMLtoDOM(htmlString, document.body);
 *
 */

define('lib/htmlparser',[],function(){

    // Regular Expressions for parsing tags and attributes
    var startTag = /^<([\-A-Za-z0-9:_]+)((?:\s+[\-A-Za-z0-9:_]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
        endTag = /^<\/([\-A-Za-z0-9:_]+)[^>]*>/,
        attr = /([\-A-Za-z0-9:_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;

    // Empty Elements - HTML 5 Working Draft 25 October 2012
    var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed,command,source,embed,track");

    // Block Elements - HTML 5 Working Draft 25 October 2012 and Web Components
    var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul,article,aside,details,dialog,summary,figure,footer,header,hgroup,nav,section,audio,video,canvas,datalist,template,element,shadow,decorator,content");

    // Inline Elements - HTML 5 Working Draft 25 October 2012
    var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var,bdi,bdo,figcaption,mark,meter,progress,ruby,rt,rp,time,wbr");

    // Elements that you can, intentionally, leave open
    // (and which close themselves)
    var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

    // Attributes that have their values filled in disabled="disabled"
    var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

    // Special Elements (can contain anything) Reference: http://www.w3.org/TR/html-markup/syntax.html#replaceable-character-data
    var special = makeMap("script,style,textarea,title");

    var HTMLParser = this.HTMLParser = function( html, handler ) {
        var index, chars, match, stack = [], last = html;
        stack.last = function(){
            return this[ this.length - 1 ];
        };

        if (html.indexOf("<!DOCTYPE")===0) {
            index = html.indexOf(">");
            if (index>=0) {
                if (handler.doctype)
                    handler.doctype(html.substring(10, index));
                html = html.substring(index + 1).replace(/^\s+/,"");
            }
        }

        while ( html ) {
            chars = true;

            // Make sure we're not in a script or style element
            if ( !stack.last() || !special[ stack.last() ] ) {

                // Comment
                if ( html.indexOf("<!--")=== 0 ) {
                    index = html.indexOf("-->");

                    if ( index >= 0 ) {
                        if ( handler.comment )
                            handler.comment( html.substring( 4, index ) );
                        html = html.substring( index + 3 );
                        chars = false;
                    }

                // end tag
                } else if ( html.indexOf("</") === 0 ) {
                    match = html.match( endTag );

                    if ( match ) {
                        html = html.substring( match[0].length );
                        match[0].replace( endTag, parseEndTag );
                        chars = false;
                    }

                // start tag
                } else if ( html.indexOf("<") === 0 ) {
                    match = html.match( startTag );

                    if ( match ) {
                        html = html.substring( match[0].length );
                        match[0].replace( startTag, parseStartTag );
                        chars = false;
                    }
                }

                if ( chars ) {
                    index = html.indexOf("<");

                    var text = index < 0 ? html : html.substring( 0, index );
                    html = index < 0 ? "" : html.substring( index );

                    if ( handler.chars )
                        handler.chars( text );
                }

            } else {
                html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){
                    text = text.replace(/<!--(.*?)-->/g, "$1")
                        .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");

                    if ( handler.chars )
                        handler.chars( text );

                    return "";
                });

                parseEndTag( "", stack.last() );
            }

            if ( html === last )
                throw "Parse Error: " + html;
            last = html;
        }

        // Clean up any remaining tags
        parseEndTag();

        function parseStartTag( tag, tagName, rest, unary ) {
            tagName = tagName.toLowerCase();

            if ( block[ tagName ] ) {
                while ( stack.last() && inline[ stack.last() ] ) {
                    parseEndTag( "", stack.last() );
                }
            }

            if ( closeSelf[ tagName ] && stack.last() === tagName ) {
                parseEndTag( "", tagName );
            }

            unary = empty[ tagName ] || !!unary;

            if ( !unary )
                stack.push( tagName );

            if ( handler.start ) {
                var attrs = [];

                rest.replace(attr, function(match, name) {
                    var value = arguments[2] ? arguments[2] :
                        arguments[3] ? arguments[3] :
                        arguments[4] ? arguments[4] :
                        fillAttrs[name] ? name : "";

                    attrs.push({
                        name: name,
                        value: value,
                        escaped: value.replace(/"/g, "&quot;")
                    });
                });

                if ( handler.start )
                    handler.start( tagName, attrs, unary );
            }
        }

        function parseEndTag( tag, tagName ) {
            var pos;
            // If no tag name is provided, clean shop
            if ( !tagName )
                pos = 0;

            // Find the closest opened tag of the same type
            else
                for ( pos = stack.length - 1; pos >= 0; pos-- )
                    if ( stack[ pos ] === tagName )
                        break;

            if ( pos >= 0 ) {
                // Close all the open elements, up the stack
                for ( var i = stack.length - 1; i >= pos; i-- )
                    if ( handler.end )
                        handler.end( stack[ i ] );

                // Remove the open elements from the stack
                stack.length = pos;
            }
        }
    };

    this.HTMLtoXML = function( html ) {
        var results = "";

        HTMLParser(html, {
            start: function( tag, attrs, unary ) {
                results += "<" + tag;

                for ( var i = 0; i < attrs.length; i++ )
                    results += " " + attrs[i].name + '="' + attrs[i].escaped + '"';

                results += (unary ? "/" : "") + ">";
            },
            end: function( tag ) {
                results += "</" + tag + ">";
            },
            chars: function( text ) {
                results += text;
            },
            comment: function( text ) {
                results += "<!--" + text + "-->";
            }
        });

        return results;
    };

    this.HTMLtoDOM = function( html, doc ) {
        // There can be only one of these elements
        var one = makeMap("html,head,body,title");

        // Enforce a structure for the document
        var structure = {
            link: "head",
            base: "head"
        };

        if ( !doc ) {
            if ( typeof DOMDocument !== "undefined" )
                doc = new DOMDocument();
            else if ( typeof document !== "undefined" && document.implementation && document.implementation.createDocument )
                doc = document.implementation.createDocument("", "", null);
            else if ( typeof ActiveX !== "undefined" )
                doc = new ActiveXObject("Msxml.DOMDocument");

        } else
            doc = doc.ownerDocument ||
                doc.getOwnerDocument && doc.getOwnerDocument() ||
                doc;

        var elems = [],
            documentElement = doc.documentElement ||
                doc.getDocumentElement && doc.getDocumentElement();

        // If we're dealing with an empty document then we
        // need to pre-populate it with the HTML document structure
        if ( !documentElement && doc.createElement ) (function(){
            var html = doc.createElement("html");
            var head = doc.createElement("head");
            head.appendChild( doc.createElement("title") );
            html.appendChild( head );
            html.appendChild( doc.createElement("body") );
            doc.appendChild( html );
        })();

        // Find all the unique elements
        if ( doc.getElementsByTagName )
            for ( var i in one )
                one[ i ] = doc.getElementsByTagName( i )[0];

        // If we're working with a document, inject contents into
        // the body element
        var curParentNode = one.body;

        HTMLParser( html, {
            start: function( tagName, attrs, unary ) {
                // If it's a pre-built element, then we can ignore
                // its construction
                if ( one[ tagName ] ) {
                    curParentNode = one[ tagName ];
                    if ( !unary ) {
                        elems.push( curParentNode );
                    }
                    return;
                }

                var elem = doc.createElement( tagName );

                for ( var attr in attrs )
                    elem.setAttribute( attrs[ attr ].name, attrs[ attr ].value );

                if ( structure[ tagName ] && typeof one[ structure[ tagName ] ] !== "boolean" )
                    one[ structure[ tagName ] ].appendChild( elem );

                else if ( curParentNode && curParentNode.appendChild )
                    curParentNode.appendChild( elem );

                if ( !unary ) {
                    elems.push( elem );
                    curParentNode = elem;
                }
            },
            end: function( /* tag */ ) {
                elems.length -= 1;

                // Init the new parentNode
                curParentNode = elems[ elems.length - 1 ];
            },
            chars: function( text ) {
                curParentNode.appendChild( doc.createTextNode( text ) );
            },
            comment: function( /* text */ ) {
                // create comment node
            }
        });

        return doc;
    };

    function makeMap(str){
        var obj = {}, items = str.split(",");
        for ( var i = 0; i < items.length; i++ )
            obj[ items[i] ] = true;
        return obj;
    }

    return {HTMLParser: HTMLParser,
        HTMLtoXML: HTMLtoXML,
        HTMLtoDOM: HTMLtoDOM
    };
});

/*
 * changes to previous injection implementations
 * - no support for data-injection anymore, switch to new data-inject
 * - no support for data-href-next anymore, switch to data-inject: next-href
 * - XXX: add support for forms, see remnants in inject1 and ajaxify
 */
define('pat/inject',[
    "jquery",
    "./ajax",
    "../core/parser",
    "../core/logger",
    "../registry",
    "../utils",
    "../lib/htmlparser",
    "../jquery-ext"  // for :scrollable for autoLoading-visible
], function($, ajax, Parser, logger, registry, utils, htmlparser) {
    var log = logger.getLogger("pat.inject"),
        parser = new Parser("inject");

    //parser.add_argument("selector", "body");
    parser.add_argument("selector");
    //XXX: (yet) unsupported: parser.add_argument("target", "$selector");
    parser.add_argument("target");
    parser.add_argument("data-type", "html");
    parser.add_argument("next-href");
    //XXX: (yet) unsupported: parser.add_argument("source", "$selector");
    parser.add_argument("source");
    parser.add_argument("trigger", "default", ["default", "autoload", "autoload-visible"]);
    // XXX: this should not be here but the parser would bail on
    // unknown parameters and expand/collapsible need to pass the url
    // to us
    parser.add_argument("url");
    parser.add_argument("class");
    parser.add_argument("history");

    var _ = {
        name: "inject",
        trigger: "a.pat-inject, form.pat-inject, .pat-subform.pat-inject",
        init: function($el, opts) {
            if ($el.length > 1)
                return $el.each(function() { _.init($(this), opts); });

            var cfgs = _.extractConfig($el, opts);

            // if the injection shall add a history entry and HTML5 pushState
            // is missing, then don't initialize the injection.
            if (cfgs.some(function(e){return e.history === "record";}) &&
                    !("pushState" in history))
                return $el;

            $el.data("patterns.inject", cfgs);

            // In case next-href is specified the anchor's href will
            // be set to it after the injection is triggered. In case
            // the next href already exists, we do not activate the
            // injection but instead just change the anchors href.
            //
            // XXX: This is used in only one project for linked
            // fullcalendars, it's sanity is wonky and we should
            // probably solve it differently. -- Maybe it's cool
            // after all.
            var $nexthref = $(cfgs[0].nextHref);
            if ($el.is("a") && $nexthref.length > 0) {
                log.debug("Skipping as next href already exists", $nexthref);
                // XXX: reconsider how the injection enters exhausted state
                return $el.attr({href: (window.location.href.split("#")[0] || "") +
                                 cfgs[0].nextHref});
            }

            switch (cfgs[0].trigger) {
            case "default":
                // setup event handlers
                if ($el.is("a")) {
                    $el.on("click.pat-inject", _.onClick);
                } else if ($el.is("form")) {
                    $el.on("submit.pat-inject", _.onSubmit)
                       .on("click.pat-inject", "[type=submit]", ajax.onClickSubmit);
                } else if ($el.is(".pat-subform")) {
                    log.debug("Initializing subform with injection");
                }
                break;
            case "autoload":
                _.onClick.apply($el[0], []);
                break;
            case "autoload-visible":
                _._initAutoloadVisible($el);
                break;
            }

            log.debug("initialised:", $el);

            return $el;
        },

        destroy: function($el) {
            $el.off(".pat-inject");
            $el.data("patterns.inject", null);
            return $el;
        },

        onClick: function(ev) {
            var cfgs = $(this).data("patterns.inject"),
                $el = $(this);
            if (ev)
                ev.preventDefault();
            $el.trigger("patterns-inject-triggered");
            _.execute(cfgs, $el);
        },

        onSubmit: function(ev) {
            var cfgs = $(this).data("patterns.inject"),
                $el = $(this);
            if (ev)
                ev.preventDefault();
            $el.trigger("patterns-inject-triggered");
            _.execute(cfgs, $el);
        },

        submitSubform: function($sub) {
            var $el = $sub.parents('form'),
                cfgs = $sub.data("patterns.inject");
            try {
                $el.trigger("patterns-inject-triggered");
            } catch (e) {
                log.error("patterns-inject-triggered", e);
            }
            _.execute(cfgs, $el);
        },

        extractConfig: function($el, opts) {
            opts = $.extend({}, opts);

            var cfgs = parser.parse($el, opts, true);
            cfgs.forEach(function(cfg) {
                var urlparts, defaultSelector;
                // opts and cfg have priority, fallback to href/action
                cfg.url = opts.url || cfg.url || $el.attr("href") ||
                    $el.attr("action") || $el.parents('form').attr('action') ||
                    "";

                // separate selector from url
                urlparts = cfg.url.split("#");
                cfg.url = urlparts[0];

                // if no selector, check for selector as part of original url
                defaultSelector = urlparts[1] && "#" + urlparts[1] || "body";

                if (urlparts.length > 2) {
                    log.warn("Ignoring additional source ids:", urlparts.slice(2));
                }

                cfg.selector = cfg.selector || defaultSelector;
            });
            return cfgs;
        },
        // verify and post-process config
        // XXX: this should return a command instead of messing around on the config
        verifyConfig: function(cfgs, $el) {
            var url = cfgs[0].url;

            // verification for each cfg in the array needs to succeed
            return cfgs.every(function(cfg) {
                // in case of multi-injection, all injections need to use
                // the same url
                if (cfg.url !== url) {
                    log.error("Unsupported different urls for multi-inject");
                    return false;
                }

                // defaults
                cfg.source = cfg.source || cfg.selector;
                cfg.target = cfg.target || cfg.selector;

                if (!_._extractModifiers(cfg))
                    return false;

                // make sure target exist
                cfg.$target = cfg.$target || (cfg.target==="self" ? $el : $(cfg.target));
                if (cfg.$target.length === 0) {
                    if (!cfg.target) {
                        log.error("Need target selector", cfg);
                        return false;
                    }
                    cfg.$target = _._createTarget(cfg.target);
                    cfg.$injected = cfg.$target;
                }
                return true;
            });
        },

        _extractModifiers: function(cfg) {
            var source_re = /^(.*?)(::element)?$/,
                target_re = /^(.*?)(::element)?(::after|::before)?$/,
                source_match = source_re.exec(cfg.source),
                target_match = target_re.exec(cfg.target),
                targetMod, targetPosition;

            // source content or element?
            cfg.source = source_match[1];
            // XXX: turn into source processor
            cfg.sourceMod = source_match[2] ? "element" : "content";

            // will be added while the ajax request is in progress
            cfg.targetLoadClasses = "injecting";

            // target content or element?
            targetMod = target_match[2] ? "element" : "content";
            cfg.target = target_match[1];
            cfg.targetLoadClasses += " injecting-" + targetMod;

            // position relative to target
            targetPosition = (target_match[3] || "::").slice(2);
            if (targetPosition)
                cfg.targetLoadClasses += " injecting-" + targetPosition;

            cfg.action = targetMod + targetPosition;

            // Once we start detecting illegal combinations, we'll
            // return false in case of error
            return true;
        },

        // create a target that matches the selector
        //
        // XXX: so far we only support #target and create a div with
        // that id appended to the body.
        _createTarget: function(selector) {
            var $target;
            if (selector.slice(0,1) !== "#") {
                log.error("only id supported for non-existing target");
                return null;
            }
            $target = $("<div />").attr({id: selector.slice(1)});
            $("body").append($target);
            return $target;
        },

        execute: function(cfgs, $el) {
            // get a kinda deep copy, we scribble on it
            cfgs = cfgs.map(function(cfg) {
                return $.extend({}, cfg);
            });

            // XXX: this need to get functional, returning a command
            // for internal use, instead of passing on cfgs
            if (!_.verifyConfig(cfgs, $el))
                return;

            // possibility for spinners on targets
            cfgs.forEach(function(cfg) {
                cfg.$target.addClass(cfg.targetLoadClasses);
            });

            var onSuccess = function(ev) {
                var data = ev && ev.jqxhr && ev.jqxhr.responseText;
                if (!data) {
                    log.warn("No response content, aborting", ev);
                    return;
                }

                var sources$ = _.callTypeHandler(cfgs[0].dataType, "sources", $el, [cfgs, data, ev]);

                cfgs.forEach(function(cfg, idx) {
                    var $source = sources$[idx];

                    if (cfg.sourceMod === "content")
                        $source = $source.contents();

                    // perform injection
                    cfg.$target.each(function() {
                        var $src;

                        // $source.clone() does not work with shived elements in IE8
                        if (document.all && document.querySelector &&
                            !document.addEventListener) {
                            $src = $source.map(function() {
                                return $(this.outerHTML)[0];
                            });
                        } else {
                            $src = $source.clone();
                        }

                        var $target = $(this),
                            $injected = cfg.$injected || $src;

                        $src.findInclusive('img').on('load', function() {
                            $(this).trigger('pat-inject-content-loaded');
                        });

                        if (_._inject($src, $target, cfg.action, cfg["class"])) {
                            $injected.filter(function() {
                                // setting data on textnode fails in IE8
                                return this.nodeType !== 3; //Node.TEXT_NODE
                            }).data("pat-injected", {origin: cfg.url});
                            $injected.addClass(cfg["class"])
                                .trigger("patterns-injected", cfg);
                        }
                        if ((cfg.history === "record") &&
                            ("pushState" in history))
                            history.pushState({url: cfg.url}, "", cfg.url);
                    });
                });

                if (cfgs[0].nextHref) {
                    $el.attr({href: (window.location.href.split("#")[0] || "") +
                              cfgs[0].nextHref});
                    _.destroy($el);

                    // XXX: this used to be the case, but I don't see
                    // why that would be a good idea.
                    //
                    // jump to new href target
                    //if (!$el.hasClass("autoLoading-visible"))
                    //    window.location.href = $el.attr('href');
                }
                $el.off("pat-ajax-success.pat-inject");
                $el.off("pat-ajax-error.pat-inject");
            };

            var onError = function() {
                cfgs.forEach(function(cfg) {
                    if ("$injected" in cfg)
                        cfg.$injected.remove();
                });
                $el.off("pat-ajax-success.pat-inject");
                $el.off("pat-ajax-error.pat-inject");
            };

            $el.on("pat-ajax-success.pat-inject", onSuccess);
            $el.on("pat-ajax-error.pat-inject", onError);

            ajax.request($el, {url: cfgs[0].url});
        },

        _inject: function($source, $target, action /* , classes */) {
            // action to jquery method mapping, except for "content"
            // and "element"
            var method = {
                contentbefore: "prepend",
                contentafter:  "append",
                elementbefore: "before",
                elementafter:  "after"
            }[action];

            if ($source.length === 0) {
                log.warn("Aborting injection, source not found:", $source);
                return false;
            }
            if ($target.length === 0) {
                log.warn("Aborting injection, target not found:", $target);
                return false;
            }

            if (action === "content")
                $target.empty().append($source);
            else if (action === "element")
                $target.replaceWith($source);
            else
                $target[method]($source);

            return true;
        },

        _sourcesFromHtml: function(html, url, sources) {
            var $html = _._parseRawHtml(html, url);
            return sources.map(function(source) {
                if (source === "body")
                    source = "#__original_body";

                var $source = $html.find(source);

                if ($source.length === 0)
                    log.warn("No source elements for selector:", source, $html);

                $source.find("a[href^=\"#\"]").each(function() {
                    var href = this.getAttribute("href");
                    // Skip in-document links pointing to an id that is inside
                    // this fragment.
                    if (href.length === 1)  // Special case for top-of-page links
                        this.href=url;
                    else if (!$source.find(href).length)
                        this.href=url+href;
                });

                return $source;
            });
        },

        _link_attributes: {
            A: "href",
            FORM: "action",
            IMG: "src",
            SOURCE: "src",
            VIDEO: "src"
        },

        _rebaseHTML_via_HTMLParser: function(base, html) {
            var output = [],
                i, link_attribute, value;

            htmlparser.HTMLParser(html, {
                start: function(tag, attrs, unary) {
                    output.push("<"+tag);
                    link_attribute = _._link_attributes[tag.toUpperCase()];
                    for (i=0; i<attrs.length; i++) {
                        if (attrs[i].name.toLowerCase() === link_attribute) {
                            value = attrs[i].value;
                            // Do not rewrite Zope views or in-document links.
                            // In-document links will be processed later after
                            // extracting the right fragment.
                            if (value.slice(0, 2) !== "@@" && value[0] !== "#") {
                                value = utils.rebaseURL(base, value);
                                value = value.replace(/(^|[^\\])"/g, '$1\\\"');
                            }
                        }  else
                            value = attrs[i].escaped;
                        output.push(" " + attrs[i].name + "=\"" + value + "\"");
                    }
                    output.push(unary ? "/>" : ">");
                },

                end: function(tag) {
                    output.push("</"+tag+">");
                },

                chars: function(text) {
                    output.push(text);
                },

                comment: function(text) {
                    output.push("<!--"+text+"-->");
                }
            });
            return output.join("");
        },

        _rebaseAttrs: {
            A: "href",
            FORM: "action",
            IMG: "data-pat-inject-rebase-src",
            SOURCE: "data-pat-inject-rebase-src",
            VIDEO: "data-pat-inject-rebase-src"
        },

        _rebaseHTML: function(base, html) {
            var $page = $(html.replace(
                /(\s)(src\s*)=/gi,
                '$1src="" data-pat-inject-rebase-$2='
            ).trim()).wrapAll('<div>').parent();

            $page.find(Object.keys(_._rebaseAttrs).join(',')).each(function() {
                var $this = $(this),
                    attrName = _._rebaseAttrs[this.tagName],
                    value = $this.attr(attrName);

                if (value && value.slice(0, 2) !== "@@" && value[0] !== "#") {
                    value = utils.rebaseURL(base, value);
                    $this.attr(attrName, value);
                }
            });
            // XXX: IE8 changes the order of attributes in html. The following
            // lines move data-pat-inject-rebase-src to src.
            $page.find('[data-pat-inject-rebase-src]').each(function() {
                var $el = $(this);
                $el.attr('src', $el.attr('data-pat-inject-rebase-src'))
                   .removeAttr('data-pat-inject-rebase-src');
            });

            return $page.html().replace(
                    /src="" data-pat-inject-rebase-/g, ''
                ).trim();
        },

        _parseRawHtml: function(html, url) {
            url = url || "";

            // remove script tags and head and replace body by a div
            var clean_html = html
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                    .replace(/<head\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/head>/gi, "")
                    .replace(/<body([^>]*?)>/gi, "<div id=\"__original_body\">")
                    .replace(/<\/body([^>]*?)>/gi, "</div>");
            try {
                clean_html = _._rebaseHTML(url, clean_html);
            } catch (e) {
                log.error("Error rebasing urls", e);
            }
            var $html = $("<div/>").html(clean_html);

            if ($html.children().length === 0)
                log.warn("Parsing html resulted in empty jquery object:", clean_html);

            return $html;
        },

        // XXX: hack
        _initAutoloadVisible: function($el) {
            // ignore executed autoloads
            if ($el.data("patterns.inject.autoloaded"))
                return false;

            var $scrollable = $el.parents(":scrollable"),
                checkVisibility;

            // function to trigger the autoload and mark as triggered
            var trigger = function() {
                $el.data("patterns.inject.autoloaded", true);
                _.onClick.apply($el[0], []);
                return true;
            };

            // Use case 1: a (heigh-constrained) scrollable parent
            if ($scrollable.length) {
                // if scrollable parent and visible -> trigger it
                // we only look at the closest scrollable parent, no nesting
                checkVisibility = function() {
                    if ($el.data("patterns.autoload"))
                        return false;
                    var reltop = $el.offset().top - $scrollable.offset().top - 1000,
                        doTrigger = reltop <= $scrollable.innerHeight();
                    if (doTrigger) {
                        // checkVisibility was possibly installed as a scroll
                        // handler and has now served its purpose -> remove
                        $($scrollable[0]).off("scroll", checkVisibility);
                        $(window).off("resize.pat-autoload", checkVisibility);
                        return trigger();
                    }
                    return false;
                };
                if (checkVisibility())
                    return true;

                // wait to become visible - again only immediate scrollable parent
                $($scrollable[0]).on("scroll", utils.debounce(checkVisibility, 100));
                $(window).on("resize.pat-autoload", utils.debounce(checkVisibility, 100));
            } else {
                // Use case 2: scrolling the entire page
                checkVisibility = function() {
                    if ($el.data("patterns.autoload"))
                        return false;
                    if (!utils.elementInViewport($el[0]))
                        return false;

                    $(window).off(".pat-autoload", checkVisibility);
                    return trigger();
                };
                if (checkVisibility())
                    return true;
                $(window).on("resize.pat-autoload scroll.pat-autoload",
                        utils.debounce(checkVisibility, 100));
            }
            return false;
        },

        // XXX: simple so far to see what the team thinks of the idea
        registerTypeHandler: function(type, handler) {
            _.handlers[type] = handler;
        },

        callTypeHandler: function(type, fn, context, params) {
            type = type || "html";

            if (_.handlers[type] && $.isFunction(_.handlers[type][fn])) {
                return _.handlers[type][fn].apply(context, params);
            } else {
                return null;
            }
        },

        handlers: {
            "html": {
                sources: function(cfgs, data) {
                    var sources = cfgs.map(function(cfg) { return cfg.source; });
                    return _._sourcesFromHtml(data, cfgs[0].url, sources);
                }
            }
        }
    };

    $(document).on("patterns-injected", function(ev, cfg) {
        cfg.$target.removeClass(cfg.targetLoadClasses);
    });

    $(window).bind("popstate", function (event) {
        // popstate also triggers on traditional anchors
        if (!event.originalEvent.state) {
            history.replaceState("anchor", "", document.location.href);
            return;
        }
        window.location.reload();
    });

    // this entry ensures that the initally loaded page can be reached with
    // the back button
    if ("replaceState" in history) {
        history.replaceState("pageload", "", document.location.href);
    }

    registry.register(_);
    return _;
});

/*
 Leaflet, a JavaScript library for mobile-friendly interactive maps. http://leafletjs.com
 (c) 2010-2013, Vladimir Agafonkin
 (c) 2010-2011, CloudMade
*/
(function (window, document, undefined) {
    var oldL = window.L,
        L = {};

    L.version = '0.7.2';

    // define Leaflet for Node module pattern loaders, including Browserify
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = L;

    // define Leaflet as an AMD module
    } else if (typeof define === 'function' && define.amd) {
        define('leaflet',[], function(L) {
            window.L = L;
            return L;
        });
    }

    // define Leaflet as a global L variable, saving the original L to restore later if needed

    L.noConflict = function () {
        window.L = oldL;
        return this;
    };

    window.L = L;

    /*
     * L.Util contains various utility functions used throughout Leaflet code.
     */

    L.Util = {
        extend: function (dest) { // (Object[, Object, ...]) ->
            var sources = Array.prototype.slice.call(arguments, 1),
                i, j, len, src;

            for (j = 0, len = sources.length; j < len; j++) {
                src = sources[j] || {};
                for (i in src) {
                    if (src.hasOwnProperty(i)) {
                        dest[i] = src[i];
                    }
                }
            }
            return dest;
        },

        bind: function (fn, obj) { // (Function, Object) -> Function
            var args = arguments.length > 2 ? Array.prototype.slice.call(arguments, 2) : null;
            return function () {
                return fn.apply(obj, args || arguments);
            };
        },

        stamp: (function () {
            var lastId = 0,
                key = '_leaflet_id';
            return function (obj) {
                obj[key] = obj[key] || ++lastId;
                return obj[key];
            };
        }()),

        invokeEach: function (obj, method, context) {
            var i, args;

            if (typeof obj === 'object') {
                args = Array.prototype.slice.call(arguments, 3);

                for (i in obj) {
                    method.apply(context, [i, obj[i]].concat(args));
                }
                return true;
            }

            return false;
        },

        limitExecByInterval: function (fn, time, context) {
            var lock, execOnUnlock;

            return function wrapperFn() {
                var args = arguments;

                if (lock) {
                    execOnUnlock = true;
                    return;
                }

                lock = true;

                setTimeout(function () {
                    lock = false;

                    if (execOnUnlock) {
                        wrapperFn.apply(context, args);
                        execOnUnlock = false;
                    }
                }, time);

                fn.apply(context, args);
            };
        },

        falseFn: function () {
            return false;
        },

        formatNum: function (num, digits) {
            var pow = Math.pow(10, digits || 5);
            return Math.round(num * pow) / pow;
        },

        trim: function (str) {
            return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
        },

        splitWords: function (str) {
            return L.Util.trim(str).split(/\s+/);
        },

        setOptions: function (obj, options) {
            obj.options = L.extend({}, obj.options, options);
            return obj.options;
        },

        getParamString: function (obj, existingUrl, uppercase) {
            var params = [];
            for (var i in obj) {
                params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
            }
            return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
        },
        template: function (str, data) {
            return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
                var value = data[key];
                if (value === undefined) {
                    throw new Error('No value provided for variable ' + str);
                } else if (typeof value === 'function') {
                    value = value(data);
                }
                return value;
            });
        },

        isArray: Array.isArray || function (obj) {
            return (Object.prototype.toString.call(obj) === '[object Array]');
        },

        emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
    };

    (function () {

        // inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

        function getPrefixed(name) {
            var i, fn,
                prefixes = ['webkit', 'moz', 'o', 'ms'];

            for (i = 0; i < prefixes.length && !fn; i++) {
                fn = window[prefixes[i] + name];
            }

            return fn;
        }

        var lastTime = 0;

        function timeoutDefer(fn) {
            var time = +new Date(),
                timeToCall = Math.max(0, 16 - (time - lastTime));

            lastTime = time + timeToCall;
            return window.setTimeout(fn, timeToCall);
        }

        var requestFn = window.requestAnimationFrame ||
                getPrefixed('RequestAnimationFrame') || timeoutDefer;

        var cancelFn = window.cancelAnimationFrame ||
                getPrefixed('CancelAnimationFrame') ||
                getPrefixed('CancelRequestAnimationFrame') ||
                function (id) { window.clearTimeout(id); };


        L.Util.requestAnimFrame = function (fn, context, immediate, element) {
            fn = L.bind(fn, context);

            if (immediate && requestFn === timeoutDefer) {
                fn();
            } else {
                return requestFn.call(window, fn, element);
            }
        };

        L.Util.cancelAnimFrame = function (id) {
            if (id) {
                cancelFn.call(window, id);
            }
        };

    }());

    // shortcuts for most used utility functions
    L.extend = L.Util.extend;
    L.bind = L.Util.bind;
    L.stamp = L.Util.stamp;
    L.setOptions = L.Util.setOptions;


    /*
     * L.Class powers the OOP facilities of the library.
     * Thanks to John Resig and Dean Edwards for inspiration!
     */

    L.Class = function () {};

    L.Class.extend = function (props) {

        // extended class with the new prototype
        var NewClass = function () {

            // call the constructor
            if (this.initialize) {
                this.initialize.apply(this, arguments);
            }

            // call all constructor hooks
            if (this._initHooks) {
                this.callInitHooks();
            }
        };

        // instantiate class without calling constructor
        var F = function () {};
        F.prototype = this.prototype;

        var proto = new F();
        proto.constructor = NewClass;

        NewClass.prototype = proto;

        //inherit parent's statics
        for (var i in this) {
            if (this.hasOwnProperty(i) && i !== 'prototype') {
                NewClass[i] = this[i];
            }
        }

        // mix static properties into the class
        if (props.statics) {
            L.extend(NewClass, props.statics);
            delete props.statics;
        }

        // mix includes into the prototype
        if (props.includes) {
            L.Util.extend.apply(null, [proto].concat(props.includes));
            delete props.includes;
        }

        // merge options
        if (props.options && proto.options) {
            props.options = L.extend({}, proto.options, props.options);
        }

        // mix given properties into the prototype
        L.extend(proto, props);

        proto._initHooks = [];

        var parent = this;
        // jshint camelcase: false
        NewClass.__super__ = parent.prototype;

        // add method for calling all hooks
        proto.callInitHooks = function () {

            if (this._initHooksCalled) { return; }

            if (parent.prototype.callInitHooks) {
                parent.prototype.callInitHooks.call(this);
            }

            this._initHooksCalled = true;

            for (var i = 0, len = proto._initHooks.length; i < len; i++) {
                proto._initHooks[i].call(this);
            }
        };

        return NewClass;
    };


    // method for adding properties to prototype
    L.Class.include = function (props) {
        L.extend(this.prototype, props);
    };

    // merge new default options to the Class
    L.Class.mergeOptions = function (options) {
        L.extend(this.prototype.options, options);
    };

    // add a constructor hook
    L.Class.addInitHook = function (fn) { // (Function) || (String, args...)
        var args = Array.prototype.slice.call(arguments, 1);

        var init = typeof fn === 'function' ? fn : function () {
            this[fn].apply(this, args);
        };

        this.prototype._initHooks = this.prototype._initHooks || [];
        this.prototype._initHooks.push(init);
    };


    /*
     * L.Mixin.Events is used to add custom events functionality to Leaflet classes.
     */

    var eventsKey = '_leaflet_events';

    L.Mixin = {};

    L.Mixin.Events = {

        addEventListener: function (types, fn, context) { // (String, Function[, Object]) or (Object[, Object])

            // types can be a map of types/handlers
            if (L.Util.invokeEach(types, this.addEventListener, this, fn, context)) { return this; }

            var events = this[eventsKey] = this[eventsKey] || {},
                contextId = context && context !== this && L.stamp(context),
                i, len, event, type, indexKey, indexLenKey, typeIndex;

            // types can be a string of space-separated words
            types = L.Util.splitWords(types);

            for (i = 0, len = types.length; i < len; i++) {
                event = {
                    action: fn,
                    context: context || this
                };
                type = types[i];

                if (contextId) {
                    // store listeners of a particular context in a separate hash (if it has an id)
                    // gives a major performance boost when removing thousands of map layers

                    indexKey = type + '_idx';
                    indexLenKey = indexKey + '_len';

                    typeIndex = events[indexKey] = events[indexKey] || {};

                    if (!typeIndex[contextId]) {
                        typeIndex[contextId] = [];

                        // keep track of the number of keys in the index to quickly check if it's empty
                        events[indexLenKey] = (events[indexLenKey] || 0) + 1;
                    }

                    typeIndex[contextId].push(event);


                } else {
                    events[type] = events[type] || [];
                    events[type].push(event);
                }
            }

            return this;
        },

        hasEventListeners: function (type) { // (String) -> Boolean
            var events = this[eventsKey];
            return !!events && ((type in events && events[type].length > 0) ||
                                (type + '_idx' in events && events[type + '_idx_len'] > 0));
        },

        removeEventListener: function (types, fn, context) { // ([String, Function, Object]) or (Object[, Object])

            if (!this[eventsKey]) {
                return this;
            }

            if (!types) {
                return this.clearAllEventListeners();
            }

            if (L.Util.invokeEach(types, this.removeEventListener, this, fn, context)) { return this; }

            var events = this[eventsKey],
                contextId = context && context !== this && L.stamp(context),
                i, len, type, listeners, j, indexKey, indexLenKey, typeIndex, removed;

            types = L.Util.splitWords(types);

            for (i = 0, len = types.length; i < len; i++) {
                type = types[i];
                indexKey = type + '_idx';
                indexLenKey = indexKey + '_len';

                typeIndex = events[indexKey];

                if (!fn) {
                    // clear all listeners for a type if function isn't specified
                    delete events[type];
                    delete events[indexKey];
                    delete events[indexLenKey];

                } else {
                    listeners = contextId && typeIndex ? typeIndex[contextId] : events[type];

                    if (listeners) {
                        for (j = listeners.length - 1; j >= 0; j--) {
                            if ((listeners[j].action === fn) && (!context || (listeners[j].context === context))) {
                                removed = listeners.splice(j, 1);
                                // set the old action to a no-op, because it is possible
                                // that the listener is being iterated over as part of a dispatch
                                removed[0].action = L.Util.falseFn;
                            }
                        }

                        if (context && typeIndex && (listeners.length === 0)) {
                            delete typeIndex[contextId];
                            events[indexLenKey]--;
                        }
                    }
                }
            }

            return this;
        },

        clearAllEventListeners: function () {
            delete this[eventsKey];
            return this;
        },

        fireEvent: function (type, data) { // (String[, Object])
            if (!this.hasEventListeners(type)) {
                return this;
            }

            var event = L.Util.extend({}, data, { type: type, target: this });

            var events = this[eventsKey],
                listeners, i, len, typeIndex, contextId;

            if (events[type]) {
                // make sure adding/removing listeners inside other listeners won't cause infinite loop
                listeners = events[type].slice();

                for (i = 0, len = listeners.length; i < len; i++) {
                    listeners[i].action.call(listeners[i].context, event);
                }
            }

            // fire event for the context-indexed listeners as well
            typeIndex = events[type + '_idx'];

            for (contextId in typeIndex) {
                listeners = typeIndex[contextId].slice();

                if (listeners) {
                    for (i = 0, len = listeners.length; i < len; i++) {
                        listeners[i].action.call(listeners[i].context, event);
                    }
                }
            }

            return this;
        },

        addOneTimeEventListener: function (types, fn, context) {

            if (L.Util.invokeEach(types, this.addOneTimeEventListener, this, fn, context)) { return this; }

            var handler = L.bind(function () {
                this
                    .removeEventListener(types, fn, context)
                    .removeEventListener(types, handler, context);
            }, this);

            return this
                .addEventListener(types, fn, context)
                .addEventListener(types, handler, context);
        }
    };

    L.Mixin.Events.on = L.Mixin.Events.addEventListener;
    L.Mixin.Events.off = L.Mixin.Events.removeEventListener;
    L.Mixin.Events.once = L.Mixin.Events.addOneTimeEventListener;
    L.Mixin.Events.fire = L.Mixin.Events.fireEvent;


    /*
     * L.Browser handles different browser and feature detections for internal Leaflet use.
     */

    (function () {

        var ie = 'ActiveXObject' in window,
            ielt9 = ie && !document.addEventListener,

            // terrible browser detection to work around Safari / iOS / Android browser bugs
            ua = navigator.userAgent.toLowerCase(),
            webkit = ua.indexOf('webkit') !== -1,
            chrome = ua.indexOf('chrome') !== -1,
            phantomjs = ua.indexOf('phantom') !== -1,
            android = ua.indexOf('android') !== -1,
            android23 = ua.search('android [23]') !== -1,
            gecko = ua.indexOf('gecko') !== -1,

            mobile = typeof orientation !== undefined + '',
            msPointer = window.navigator && window.navigator.msPointerEnabled &&
                      window.navigator.msMaxTouchPoints && !window.PointerEvent,
            pointer = (window.PointerEvent && window.navigator.pointerEnabled && window.navigator.maxTouchPoints) ||
                      msPointer,
            retina = ('devicePixelRatio' in window && window.devicePixelRatio > 1) ||
                     ('matchMedia' in window && window.matchMedia('(min-resolution:144dpi)') &&
                      window.matchMedia('(min-resolution:144dpi)').matches),

            doc = document.documentElement,
            ie3d = ie && ('transition' in doc.style),
            webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23,
            gecko3d = 'MozPerspective' in doc.style,
            opera3d = 'OTransition' in doc.style,
            any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d || opera3d) && !phantomjs;


        // PhantomJS has 'ontouchstart' in document.documentElement, but doesn't actually support touch.
        // https://github.com/Leaflet/Leaflet/pull/1434#issuecomment-13843151

        var touch = !window.L_NO_TOUCH && !phantomjs && (function () {

            var startName = 'ontouchstart';

            // IE10+ (We simulate these into touch* events in L.DomEvent and L.DomEvent.Pointer) or WebKit, etc.
            if (pointer || (startName in doc)) {
                return true;
            }

            // Firefox/Gecko
            var div = document.createElement('div'),
                supported = false;

            if (!div.setAttribute) {
                return false;
            }
            div.setAttribute(startName, 'return;');

            if (typeof div[startName] === 'function') {
                supported = true;
            }

            div.removeAttribute(startName);
            div = null;

            return supported;
        }());


        L.Browser = {
            ie: ie,
            ielt9: ielt9,
            webkit: webkit,
            gecko: gecko && !webkit && !window.opera && !ie,

            android: android,
            android23: android23,

            chrome: chrome,

            ie3d: ie3d,
            webkit3d: webkit3d,
            gecko3d: gecko3d,
            opera3d: opera3d,
            any3d: any3d,

            mobile: mobile,
            mobileWebkit: mobile && webkit,
            mobileWebkit3d: mobile && webkit3d,
            mobileOpera: mobile && window.opera,

            touch: touch,
            msPointer: msPointer,
            pointer: pointer,

            retina: retina
        };

    }());


    /*
     * L.Point represents a point with x and y coordinates.
     */

    L.Point = function (/*Number*/ x, /*Number*/ y, /*Boolean*/ round) {
        this.x = (round ? Math.round(x) : x);
        this.y = (round ? Math.round(y) : y);
    };

    L.Point.prototype = {

        clone: function () {
            return new L.Point(this.x, this.y);
        },

        // non-destructive, returns a new point
        add: function (point) {
            return this.clone()._add(L.point(point));
        },

        // destructive, used directly for performance in situations where it's safe to modify existing point
        _add: function (point) {
            this.x += point.x;
            this.y += point.y;
            return this;
        },

        subtract: function (point) {
            return this.clone()._subtract(L.point(point));
        },

        _subtract: function (point) {
            this.x -= point.x;
            this.y -= point.y;
            return this;
        },

        divideBy: function (num) {
            return this.clone()._divideBy(num);
        },

        _divideBy: function (num) {
            this.x /= num;
            this.y /= num;
            return this;
        },

        multiplyBy: function (num) {
            return this.clone()._multiplyBy(num);
        },

        _multiplyBy: function (num) {
            this.x *= num;
            this.y *= num;
            return this;
        },

        round: function () {
            return this.clone()._round();
        },

        _round: function () {
            this.x = Math.round(this.x);
            this.y = Math.round(this.y);
            return this;
        },

        floor: function () {
            return this.clone()._floor();
        },

        _floor: function () {
            this.x = Math.floor(this.x);
            this.y = Math.floor(this.y);
            return this;
        },

        distanceTo: function (point) {
            point = L.point(point);

            var x = point.x - this.x,
                y = point.y - this.y;

            return Math.sqrt(x * x + y * y);
        },

        equals: function (point) {
            point = L.point(point);

            return point.x === this.x &&
                   point.y === this.y;
        },

        contains: function (point) {
            point = L.point(point);

            return Math.abs(point.x) <= Math.abs(this.x) &&
                   Math.abs(point.y) <= Math.abs(this.y);
        },

        toString: function () {
            return 'Point(' +
                    L.Util.formatNum(this.x) + ', ' +
                    L.Util.formatNum(this.y) + ')';
        }
    };

    L.point = function (x, y, round) {
        if (x instanceof L.Point) {
            return x;
        }
        if (L.Util.isArray(x)) {
            return new L.Point(x[0], x[1]);
        }
        if (x === undefined || x === null) {
            return x;
        }
        return new L.Point(x, y, round);
    };


    /*
     * L.Bounds represents a rectangular area on the screen in pixel coordinates.
     */

    L.Bounds = function (a, b) { //(Point, Point) or Point[]
        if (!a) { return; }

        var points = b ? [a, b] : a;

        for (var i = 0, len = points.length; i < len; i++) {
            this.extend(points[i]);
        }
    };

    L.Bounds.prototype = {
        // extend the bounds to contain the given point
        extend: function (point) { // (Point)
            point = L.point(point);

            if (!this.min && !this.max) {
                this.min = point.clone();
                this.max = point.clone();
            } else {
                this.min.x = Math.min(point.x, this.min.x);
                this.max.x = Math.max(point.x, this.max.x);
                this.min.y = Math.min(point.y, this.min.y);
                this.max.y = Math.max(point.y, this.max.y);
            }
            return this;
        },

        getCenter: function (round) { // (Boolean) -> Point
            return new L.Point(
                    (this.min.x + this.max.x) / 2,
                    (this.min.y + this.max.y) / 2, round);
        },

        getBottomLeft: function () { // -> Point
            return new L.Point(this.min.x, this.max.y);
        },

        getTopRight: function () { // -> Point
            return new L.Point(this.max.x, this.min.y);
        },

        getSize: function () {
            return this.max.subtract(this.min);
        },

        contains: function (obj) { // (Bounds) or (Point) -> Boolean
            var min, max;

            if (typeof obj[0] === 'number' || obj instanceof L.Point) {
                obj = L.point(obj);
            } else {
                obj = L.bounds(obj);
            }

            if (obj instanceof L.Bounds) {
                min = obj.min;
                max = obj.max;
            } else {
                min = max = obj;
            }

            return (min.x >= this.min.x) &&
                   (max.x <= this.max.x) &&
                   (min.y >= this.min.y) &&
                   (max.y <= this.max.y);
        },

        intersects: function (bounds) { // (Bounds) -> Boolean
            bounds = L.bounds(bounds);

            var min = this.min,
                max = this.max,
                min2 = bounds.min,
                max2 = bounds.max,
                xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
                yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

            return xIntersects && yIntersects;
        },

        isValid: function () {
            return !!(this.min && this.max);
        }
    };

    L.bounds = function (a, b) { // (Bounds) or (Point, Point) or (Point[])
        if (!a || a instanceof L.Bounds) {
            return a;
        }
        return new L.Bounds(a, b);
    };


    /*
     * L.Transformation is an utility class to perform simple point transformations through a 2d-matrix.
     */

    L.Transformation = function (a, b, c, d) {
        this._a = a;
        this._b = b;
        this._c = c;
        this._d = d;
    };

    L.Transformation.prototype = {
        transform: function (point, scale) { // (Point, Number) -> Point
            return this._transform(point.clone(), scale);
        },

        // destructive transform (faster)
        _transform: function (point, scale) {
            scale = scale || 1;
            point.x = scale * (this._a * point.x + this._b);
            point.y = scale * (this._c * point.y + this._d);
            return point;
        },

        untransform: function (point, scale) {
            scale = scale || 1;
            return new L.Point(
                    (point.x / scale - this._b) / this._a,
                    (point.y / scale - this._d) / this._c);
        }
    };


    /*
     * L.DomUtil contains various utility functions for working with DOM.
     */

    L.DomUtil = {
        get: function (id) {
            return (typeof id === 'string' ? document.getElementById(id) : id);
        },

        getStyle: function (el, style) {

            var value = el.style[style];

            if (!value && el.currentStyle) {
                value = el.currentStyle[style];
            }

            if ((!value || value === 'auto') && document.defaultView) {
                var css = document.defaultView.getComputedStyle(el, null);
                value = css ? css[style] : null;
            }

            return value === 'auto' ? null : value;
        },

        getViewportOffset: function (element) {

            var top = 0,
                left = 0,
                el = element,
                docBody = document.body,
                docEl = document.documentElement,
                pos;

            do {
                top  += el.offsetTop  || 0;
                left += el.offsetLeft || 0;

                //add borders
                top += parseInt(L.DomUtil.getStyle(el, 'borderTopWidth'), 10) || 0;
                left += parseInt(L.DomUtil.getStyle(el, 'borderLeftWidth'), 10) || 0;

                pos = L.DomUtil.getStyle(el, 'position');

                if (el.offsetParent === docBody && pos === 'absolute') { break; }

                if (pos === 'fixed') {
                    top  += docBody.scrollTop  || docEl.scrollTop  || 0;
                    left += docBody.scrollLeft || docEl.scrollLeft || 0;
                    break;
                }

                if (pos === 'relative' && !el.offsetLeft) {
                    var width = L.DomUtil.getStyle(el, 'width'),
                        maxWidth = L.DomUtil.getStyle(el, 'max-width'),
                        r = el.getBoundingClientRect();

                    if (width !== 'none' || maxWidth !== 'none') {
                        left += r.left + el.clientLeft;
                    }

                    //calculate full y offset since we're breaking out of the loop
                    top += r.top + (docBody.scrollTop  || docEl.scrollTop  || 0);

                    break;
                }

                el = el.offsetParent;

            } while (el);

            el = element;

            do {
                if (el === docBody) { break; }

                top  -= el.scrollTop  || 0;
                left -= el.scrollLeft || 0;

                el = el.parentNode;
            } while (el);

            return new L.Point(left, top);
        },

        documentIsLtr: function () {
            if (!L.DomUtil._docIsLtrCached) {
                L.DomUtil._docIsLtrCached = true;
                L.DomUtil._docIsLtr = L.DomUtil.getStyle(document.body, 'direction') === 'ltr';
            }
            return L.DomUtil._docIsLtr;
        },

        create: function (tagName, className, container) {

            var el = document.createElement(tagName);
            el.className = className;

            if (container) {
                container.appendChild(el);
            }

            return el;
        },

        hasClass: function (el, name) {
            if (el.classList !== undefined) {
                return el.classList.contains(name);
            }
            var className = L.DomUtil._getClass(el);
            return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
        },

        addClass: function (el, name) {
            if (el.classList !== undefined) {
                var classes = L.Util.splitWords(name);
                for (var i = 0, len = classes.length; i < len; i++) {
                    el.classList.add(classes[i]);
                }
            } else if (!L.DomUtil.hasClass(el, name)) {
                var className = L.DomUtil._getClass(el);
                L.DomUtil._setClass(el, (className ? className + ' ' : '') + name);
            }
        },

        removeClass: function (el, name) {
            if (el.classList !== undefined) {
                el.classList.remove(name);
            } else {
                L.DomUtil._setClass(el, L.Util.trim((' ' + L.DomUtil._getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
            }
        },

        _setClass: function (el, name) {
            if (el.className.baseVal === undefined) {
                el.className = name;
            } else {
                // in case of SVG element
                el.className.baseVal = name;
            }
        },

        _getClass: function (el) {
            return el.className.baseVal === undefined ? el.className : el.className.baseVal;
        },

        setOpacity: function (el, value) {

            if ('opacity' in el.style) {
                el.style.opacity = value;

            } else if ('filter' in el.style) {

                var filter = false,
                    filterName = 'DXImageTransform.Microsoft.Alpha';

                // filters collection throws an error if we try to retrieve a filter that doesn't exist
                try {
                    filter = el.filters.item(filterName);
                } catch (e) {
                    // don't set opacity to 1 if we haven't already set an opacity,
                    // it isn't needed and breaks transparent pngs.
                    if (value === 1) { return; }
                }

                value = Math.round(value * 100);

                if (filter) {
                    filter.Enabled = (value !== 100);
                    filter.Opacity = value;
                } else {
                    el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
                }
            }
        },

        testProp: function (props) {

            var style = document.documentElement.style;

            for (var i = 0; i < props.length; i++) {
                if (props[i] in style) {
                    return props[i];
                }
            }
            return false;
        },

        getTranslateString: function (point) {
            // on WebKit browsers (Chrome/Safari/iOS Safari/Android) using translate3d instead of translate
            // makes animation smoother as it ensures HW accel is used. Firefox 13 doesn't care
            // (same speed either way), Opera 12 doesn't support translate3d

            var is3d = L.Browser.webkit3d,
                open = 'translate' + (is3d ? '3d' : '') + '(',
                close = (is3d ? ',0' : '') + ')';

            return open + point.x + 'px,' + point.y + 'px' + close;
        },

        getScaleString: function (scale, origin) {

            var preTranslateStr = L.DomUtil.getTranslateString(origin.add(origin.multiplyBy(-1 * scale))),
                scaleStr = ' scale(' + scale + ') ';

            return preTranslateStr + scaleStr;
        },

        setPosition: function (el, point, disable3D) { // (HTMLElement, Point[, Boolean])

            // jshint camelcase: false
            el._leaflet_pos = point;

            if (!disable3D && L.Browser.any3d) {
                el.style[L.DomUtil.TRANSFORM] =  L.DomUtil.getTranslateString(point);
            } else {
                el.style.left = point.x + 'px';
                el.style.top = point.y + 'px';
            }
        },

        getPosition: function (el) {
            // this method is only used for elements previously positioned using setPosition,
            // so it's safe to cache the position for performance

            // jshint camelcase: false
            return el._leaflet_pos;
        }
    };


    // prefix style property names

    L.DomUtil.TRANSFORM = L.DomUtil.testProp(
            ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

    // webkitTransition comes first because some browser versions that drop vendor prefix don't do
    // the same for the transitionend event, in particular the Android 4.1 stock browser

    L.DomUtil.TRANSITION = L.DomUtil.testProp(
            ['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

    L.DomUtil.TRANSITION_END =
            L.DomUtil.TRANSITION === 'webkitTransition' || L.DomUtil.TRANSITION === 'OTransition' ?
            L.DomUtil.TRANSITION + 'End' : 'transitionend';

    (function () {
        if ('onselectstart' in document) {
            L.extend(L.DomUtil, {
                disableTextSelection: function () {
                    L.DomEvent.on(window, 'selectstart', L.DomEvent.preventDefault);
                },

                enableTextSelection: function () {
                    L.DomEvent.off(window, 'selectstart', L.DomEvent.preventDefault);
                }
            });
        } else {
            var userSelectProperty = L.DomUtil.testProp(
                ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

            L.extend(L.DomUtil, {
                disableTextSelection: function () {
                    if (userSelectProperty) {
                        var style = document.documentElement.style;
                        this._userSelect = style[userSelectProperty];
                        style[userSelectProperty] = 'none';
                    }
                },

                enableTextSelection: function () {
                    if (userSelectProperty) {
                        document.documentElement.style[userSelectProperty] = this._userSelect;
                        delete this._userSelect;
                    }
                }
            });
        }

        L.extend(L.DomUtil, {
            disableImageDrag: function () {
                L.DomEvent.on(window, 'dragstart', L.DomEvent.preventDefault);
            },

            enableImageDrag: function () {
                L.DomEvent.off(window, 'dragstart', L.DomEvent.preventDefault);
            }
        });
    })();


    /*
     * L.LatLng represents a geographical point with latitude and longitude coordinates.
     */

    L.LatLng = function (lat, lng, alt) { // (Number, Number, Number)
        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
        }

        this.lat = lat;
        this.lng = lng;

        if (alt !== undefined) {
            this.alt = parseFloat(alt);
        }
    };

    L.extend(L.LatLng, {
        DEG_TO_RAD: Math.PI / 180,
        RAD_TO_DEG: 180 / Math.PI,
        MAX_MARGIN: 1.0E-9 // max margin of error for the "equals" check
    });

    L.LatLng.prototype = {
        equals: function (obj) { // (LatLng) -> Boolean
            if (!obj) { return false; }

            obj = L.latLng(obj);

            var margin = Math.max(
                    Math.abs(this.lat - obj.lat),
                    Math.abs(this.lng - obj.lng));

            return margin <= L.LatLng.MAX_MARGIN;
        },

        toString: function (precision) { // (Number) -> String
            return 'LatLng(' +
                    L.Util.formatNum(this.lat, precision) + ', ' +
                    L.Util.formatNum(this.lng, precision) + ')';
        },

        // Haversine distance formula, see http://en.wikipedia.org/wiki/Haversine_formula
        // TODO move to projection code, LatLng shouldn't know about Earth
        distanceTo: function (other) { // (LatLng) -> Number
            other = L.latLng(other);

            var R = 6378137, // earth radius in meters
                d2r = L.LatLng.DEG_TO_RAD,
                dLat = (other.lat - this.lat) * d2r,
                dLon = (other.lng - this.lng) * d2r,
                lat1 = this.lat * d2r,
                lat2 = other.lat * d2r,
                sin1 = Math.sin(dLat / 2),
                sin2 = Math.sin(dLon / 2);

            var a = sin1 * sin1 + sin2 * sin2 * Math.cos(lat1) * Math.cos(lat2);

            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        },

        wrap: function (a, b) { // (Number, Number) -> LatLng
            var lng = this.lng;

            a = a || -180;
            b = b ||  180;

            lng = (lng + b) % (b - a) + (lng < a || lng === b ? b : a);

            return new L.LatLng(this.lat, lng);
        }
    };

    L.latLng = function (a, b) { // (LatLng) or ([Number, Number]) or (Number, Number)
        if (a instanceof L.LatLng) {
            return a;
        }
        if (L.Util.isArray(a)) {
            if (typeof a[0] === 'number' || typeof a[0] === 'string') {
                return new L.LatLng(a[0], a[1], a[2]);
            } else {
                return null;
            }
        }
        if (a === undefined || a === null) {
            return a;
        }
        if (typeof a === 'object' && 'lat' in a) {
            return new L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon);
        }
        if (b === undefined) {
            return null;
        }
        return new L.LatLng(a, b);
    };



    /*
     * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
     */

    L.LatLngBounds = function (southWest, northEast) { // (LatLng, LatLng) or (LatLng[])
        if (!southWest) { return; }

        var latlngs = northEast ? [southWest, northEast] : southWest;

        for (var i = 0, len = latlngs.length; i < len; i++) {
            this.extend(latlngs[i]);
        }
    };

    L.LatLngBounds.prototype = {
        // extend the bounds to contain the given point or bounds
        extend: function (obj) { // (LatLng) or (LatLngBounds)
            if (!obj) { return this; }

            var latLng = L.latLng(obj);
            if (latLng !== null) {
                obj = latLng;
            } else {
                obj = L.latLngBounds(obj);
            }

            if (obj instanceof L.LatLng) {
                if (!this._southWest && !this._northEast) {
                    this._southWest = new L.LatLng(obj.lat, obj.lng);
                    this._northEast = new L.LatLng(obj.lat, obj.lng);
                } else {
                    this._southWest.lat = Math.min(obj.lat, this._southWest.lat);
                    this._southWest.lng = Math.min(obj.lng, this._southWest.lng);

                    this._northEast.lat = Math.max(obj.lat, this._northEast.lat);
                    this._northEast.lng = Math.max(obj.lng, this._northEast.lng);
                }
            } else if (obj instanceof L.LatLngBounds) {
                this.extend(obj._southWest);
                this.extend(obj._northEast);
            }
            return this;
        },

        // extend the bounds by a percentage
        pad: function (bufferRatio) { // (Number) -> LatLngBounds
            var sw = this._southWest,
                ne = this._northEast,
                heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
                widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

            return new L.LatLngBounds(
                    new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
                    new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
        },

        getCenter: function () { // -> LatLng
            return new L.LatLng(
                    (this._southWest.lat + this._northEast.lat) / 2,
                    (this._southWest.lng + this._northEast.lng) / 2);
        },

        getSouthWest: function () {
            return this._southWest;
        },

        getNorthEast: function () {
            return this._northEast;
        },

        getNorthWest: function () {
            return new L.LatLng(this.getNorth(), this.getWest());
        },

        getSouthEast: function () {
            return new L.LatLng(this.getSouth(), this.getEast());
        },

        getWest: function () {
            return this._southWest.lng;
        },

        getSouth: function () {
            return this._southWest.lat;
        },

        getEast: function () {
            return this._northEast.lng;
        },

        getNorth: function () {
            return this._northEast.lat;
        },

        contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
            if (typeof obj[0] === 'number' || obj instanceof L.LatLng) {
                obj = L.latLng(obj);
            } else {
                obj = L.latLngBounds(obj);
            }

            var sw = this._southWest,
                ne = this._northEast,
                sw2, ne2;

            if (obj instanceof L.LatLngBounds) {
                sw2 = obj.getSouthWest();
                ne2 = obj.getNorthEast();
            } else {
                sw2 = ne2 = obj;
            }

            return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
                   (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
        },

        intersects: function (bounds) { // (LatLngBounds)
            bounds = L.latLngBounds(bounds);

            var sw = this._southWest,
                ne = this._northEast,
                sw2 = bounds.getSouthWest(),
                ne2 = bounds.getNorthEast(),

                latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
                lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

            return latIntersects && lngIntersects;
        },

        toBBoxString: function () {
            return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
        },

        equals: function (bounds) { // (LatLngBounds)
            if (!bounds) { return false; }

            bounds = L.latLngBounds(bounds);

            return this._southWest.equals(bounds.getSouthWest()) &&
                   this._northEast.equals(bounds.getNorthEast());
        },

        isValid: function () {
            return !!(this._southWest && this._northEast);
        }
    };

    //TODO International date line?

    L.latLngBounds = function (a, b) { // (LatLngBounds) or (LatLng, LatLng)
        if (!a || a instanceof L.LatLngBounds) {
            return a;
        }
        return new L.LatLngBounds(a, b);
    };


    /*
     * L.Projection contains various geographical projections used by CRS classes.
     */

    L.Projection = {};


    /*
     * Spherical Mercator is the most popular map projection, used by EPSG:3857 CRS used by default.
     */

    L.Projection.SphericalMercator = {
        MAX_LATITUDE: 85.0511287798,

        project: function (latlng) { // (LatLng) -> Point
            var d = L.LatLng.DEG_TO_RAD,
                max = this.MAX_LATITUDE,
                lat = Math.max(Math.min(max, latlng.lat), -max),
                x = latlng.lng * d,
                y = lat * d;

            y = Math.log(Math.tan((Math.PI / 4) + (y / 2)));

            return new L.Point(x, y);
        },

        unproject: function (point) { // (Point, Boolean) -> LatLng
            var d = L.LatLng.RAD_TO_DEG,
                lng = point.x * d,
                lat = (2 * Math.atan(Math.exp(point.y)) - (Math.PI / 2)) * d;

            return new L.LatLng(lat, lng);
        }
    };


    /*
     * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
     */

    L.Projection.LonLat = {
        project: function (latlng) {
            return new L.Point(latlng.lng, latlng.lat);
        },

        unproject: function (point) {
            return new L.LatLng(point.y, point.x);
        }
    };


    /*
     * L.CRS is a base object for all defined CRS (Coordinate Reference Systems) in Leaflet.
     */

    L.CRS = {
        latLngToPoint: function (latlng, zoom) { // (LatLng, Number) -> Point
            var projectedPoint = this.projection.project(latlng),
                scale = this.scale(zoom);

            return this.transformation._transform(projectedPoint, scale);
        },

        pointToLatLng: function (point, zoom) { // (Point, Number[, Boolean]) -> LatLng
            var scale = this.scale(zoom),
                untransformedPoint = this.transformation.untransform(point, scale);

            return this.projection.unproject(untransformedPoint);
        },

        project: function (latlng) {
            return this.projection.project(latlng);
        },

        scale: function (zoom) {
            return 256 * Math.pow(2, zoom);
        },

        getSize: function (zoom) {
            var s = this.scale(zoom);
            return L.point(s, s);
        }
    };


    /*
     * A simple CRS that can be used for flat non-Earth maps like panoramas or game maps.
     */

    L.CRS.Simple = L.extend({}, L.CRS, {
        projection: L.Projection.LonLat,
        transformation: new L.Transformation(1, 0, -1, 0),

        scale: function (zoom) {
            return Math.pow(2, zoom);
        }
    });


    /*
     * L.CRS.EPSG3857 (Spherical Mercator) is the most common CRS for web mapping
     * and is used by Leaflet by default.
     */

    L.CRS.EPSG3857 = L.extend({}, L.CRS, {
        code: 'EPSG:3857',

        projection: L.Projection.SphericalMercator,
        transformation: new L.Transformation(0.5 / Math.PI, 0.5, -0.5 / Math.PI, 0.5),

        project: function (latlng) { // (LatLng) -> Point
            var projectedPoint = this.projection.project(latlng),
                earthRadius = 6378137;
            return projectedPoint.multiplyBy(earthRadius);
        }
    });

    L.CRS.EPSG900913 = L.extend({}, L.CRS.EPSG3857, {
        code: 'EPSG:900913'
    });


    /*
     * L.CRS.EPSG4326 is a CRS popular among advanced GIS specialists.
     */

    L.CRS.EPSG4326 = L.extend({}, L.CRS, {
        code: 'EPSG:4326',

        projection: L.Projection.LonLat,
        transformation: new L.Transformation(1 / 360, 0.5, -1 / 360, 0.5)
    });


    /*
     * L.Map is the central class of the API - it is used to create a map.
     */

    L.Map = L.Class.extend({

        includes: L.Mixin.Events,

        options: {
            crs: L.CRS.EPSG3857,

            /*
            center: LatLng,
            zoom: Number,
            layers: Array,
            */

            fadeAnimation: L.DomUtil.TRANSITION && !L.Browser.android23,
            trackResize: true,
            markerZoomAnimation: L.DomUtil.TRANSITION && L.Browser.any3d
        },

        initialize: function (id, options) { // (HTMLElement or String, Object)
            options = L.setOptions(this, options);


            this._initContainer(id);
            this._initLayout();

            // hack for https://github.com/Leaflet/Leaflet/issues/1980
            this._onResize = L.bind(this._onResize, this);

            this._initEvents();

            if (options.maxBounds) {
                this.setMaxBounds(options.maxBounds);
            }

            if (options.center && options.zoom !== undefined) {
                this.setView(L.latLng(options.center), options.zoom, {reset: true});
            }

            this._handlers = [];

            this._layers = {};
            this._zoomBoundLayers = {};
            this._tileLayersNum = 0;

            this.callInitHooks();

            this._addLayers(options.layers);
        },


        // public methods that modify map state

        // replaced by animation-powered implementation in Map.PanAnimation.js
        setView: function (center, zoom) {
            zoom = zoom === undefined ? this.getZoom() : zoom;
            this._resetView(L.latLng(center), this._limitZoom(zoom));
            return this;
        },

        setZoom: function (zoom, options) {
            if (!this._loaded) {
                this._zoom = this._limitZoom(zoom);
                return this;
            }
            return this.setView(this.getCenter(), zoom, {zoom: options});
        },

        zoomIn: function (delta, options) {
            return this.setZoom(this._zoom + (delta || 1), options);
        },

        zoomOut: function (delta, options) {
            return this.setZoom(this._zoom - (delta || 1), options);
        },

        setZoomAround: function (latlng, zoom, options) {
            var scale = this.getZoomScale(zoom),
                viewHalf = this.getSize().divideBy(2),
                containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPoint(latlng),

                centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
                newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

            return this.setView(newCenter, zoom, {zoom: options});
        },

        fitBounds: function (bounds, options) {

            options = options || {};
            bounds = bounds.getBounds ? bounds.getBounds() : L.latLngBounds(bounds);

            var paddingTL = L.point(options.paddingTopLeft || options.padding || [0, 0]),
                paddingBR = L.point(options.paddingBottomRight || options.padding || [0, 0]),

                zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR)),
                paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

                swPoint = this.project(bounds.getSouthWest(), zoom),
                nePoint = this.project(bounds.getNorthEast(), zoom),
                center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

            zoom = options && options.maxZoom ? Math.min(options.maxZoom, zoom) : zoom;

            return this.setView(center, zoom, options);
        },

        fitWorld: function (options) {
            return this.fitBounds([[-90, -180], [90, 180]], options);
        },

        panTo: function (center, options) { // (LatLng)
            return this.setView(center, this._zoom, {pan: options});
        },

        panBy: function (offset) { // (Point)
            // replaced with animated panBy in Map.PanAnimation.js
            this.fire('movestart');

            this._rawPanBy(L.point(offset));

            this.fire('move');
            return this.fire('moveend');
        },

        setMaxBounds: function (bounds) {
            bounds = L.latLngBounds(bounds);

            this.options.maxBounds = bounds;

            if (!bounds) {
                return this.off('moveend', this._panInsideMaxBounds, this);
            }

            if (this._loaded) {
                this._panInsideMaxBounds();
            }

            return this.on('moveend', this._panInsideMaxBounds, this);
        },

        panInsideBounds: function (bounds, options) {
            var center = this.getCenter(),
                newCenter = this._limitCenter(center, this._zoom, bounds);

            if (center.equals(newCenter)) { return this; }

            return this.panTo(newCenter, options);
        },

        addLayer: function (layer) {
            // TODO method is too big, refactor

            var id = L.stamp(layer);

            if (this._layers[id]) { return this; }

            this._layers[id] = layer;

            // TODO getMaxZoom, getMinZoom in ILayer (instead of options)
            if (layer.options && (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom))) {
                this._zoomBoundLayers[id] = layer;
                this._updateZoomLevels();
            }

            // TODO looks ugly, refactor!!!
            if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
                this._tileLayersNum++;
                this._tileLayersToLoad++;
                layer.on('load', this._onTileLayerLoad, this);
            }

            if (this._loaded) {
                this._layerAdd(layer);
            }

            return this;
        },

        removeLayer: function (layer) {
            var id = L.stamp(layer);

            if (!this._layers[id]) { return this; }

            if (this._loaded) {
                layer.onRemove(this);
            }

            delete this._layers[id];

            if (this._loaded) {
                this.fire('layerremove', {layer: layer});
            }

            if (this._zoomBoundLayers[id]) {
                delete this._zoomBoundLayers[id];
                this._updateZoomLevels();
            }

            // TODO looks ugly, refactor
            if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
                this._tileLayersNum--;
                this._tileLayersToLoad--;
                layer.off('load', this._onTileLayerLoad, this);
            }

            return this;
        },

        hasLayer: function (layer) {
            if (!layer) { return false; }

            return (L.stamp(layer) in this._layers);
        },

        eachLayer: function (method, context) {
            for (var i in this._layers) {
                method.call(context, this._layers[i]);
            }
            return this;
        },

        invalidateSize: function (options) {
            if (!this._loaded) { return this; }

            options = L.extend({
                animate: false,
                pan: true
            }, options === true ? {animate: true} : options);

            var oldSize = this.getSize();
            this._sizeChanged = true;
            this._initialCenter = null;

            var newSize = this.getSize(),
                oldCenter = oldSize.divideBy(2).round(),
                newCenter = newSize.divideBy(2).round(),
                offset = oldCenter.subtract(newCenter);

            if (!offset.x && !offset.y) { return this; }

            if (options.animate && options.pan) {
                this.panBy(offset);

            } else {
                if (options.pan) {
                    this._rawPanBy(offset);
                }

                this.fire('move');

                if (options.debounceMoveend) {
                    clearTimeout(this._sizeTimer);
                    this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
                } else {
                    this.fire('moveend');
                }
            }

            return this.fire('resize', {
                oldSize: oldSize,
                newSize: newSize
            });
        },

        // TODO handler.addTo
        addHandler: function (name, HandlerClass) {
            if (!HandlerClass) { return this; }

            var handler = this[name] = new HandlerClass(this);

            this._handlers.push(handler);

            if (this.options[name]) {
                handler.enable();
            }

            return this;
        },

        remove: function () {
            if (this._loaded) {
                this.fire('unload');
            }

            this._initEvents('off');

            try {
                // throws error in IE6-8
                delete this._container._leaflet;
            } catch (e) {
                this._container._leaflet = undefined;
            }

            this._clearPanes();
            if (this._clearControlPos) {
                this._clearControlPos();
            }

            this._clearHandlers();

            return this;
        },


        // public methods for getting map state

        getCenter: function () { // (Boolean) -> LatLng
            this._checkIfLoaded();

            if (this._initialCenter && !this._moved()) {
                return this._initialCenter;
            }
            return this.layerPointToLatLng(this._getCenterLayerPoint());
        },

        getZoom: function () {
            return this._zoom;
        },

        getBounds: function () {
            var bounds = this.getPixelBounds(),
                sw = this.unproject(bounds.getBottomLeft()),
                ne = this.unproject(bounds.getTopRight());

            return new L.LatLngBounds(sw, ne);
        },

        getMinZoom: function () {
            return this.options.minZoom === undefined ?
                (this._layersMinZoom === undefined ? 0 : this._layersMinZoom) :
                this.options.minZoom;
        },

        getMaxZoom: function () {
            return this.options.maxZoom === undefined ?
                (this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
                this.options.maxZoom;
        },

        getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
            bounds = L.latLngBounds(bounds);

            var zoom = this.getMinZoom() - (inside ? 1 : 0),
                maxZoom = this.getMaxZoom(),
                size = this.getSize(),

                nw = bounds.getNorthWest(),
                se = bounds.getSouthEast(),

                zoomNotFound = true,
                boundsSize;

            padding = L.point(padding || [0, 0]);

            do {
                zoom++;
                boundsSize = this.project(se, zoom).subtract(this.project(nw, zoom)).add(padding);
                zoomNotFound = !inside ? size.contains(boundsSize) : boundsSize.x < size.x || boundsSize.y < size.y;

            } while (zoomNotFound && zoom <= maxZoom);

            if (zoomNotFound && inside) {
                return null;
            }

            return inside ? zoom : zoom - 1;
        },

        getSize: function () {
            if (!this._size || this._sizeChanged) {
                this._size = new L.Point(
                    this._container.clientWidth,
                    this._container.clientHeight);

                this._sizeChanged = false;
            }
            return this._size.clone();
        },

        getPixelBounds: function () {
            var topLeftPoint = this._getTopLeftPoint();
            return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
        },

        getPixelOrigin: function () {
            this._checkIfLoaded();
            return this._initialTopLeftPoint;
        },

        getPanes: function () {
            return this._panes;
        },

        getContainer: function () {
            return this._container;
        },


        // TODO replace with universal implementation after refactoring projections

        getZoomScale: function (toZoom) {
            var crs = this.options.crs;
            return crs.scale(toZoom) / crs.scale(this._zoom);
        },

        getScaleZoom: function (scale) {
            return this._zoom + (Math.log(scale) / Math.LN2);
        },


        // conversion methods

        project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
            zoom = zoom === undefined ? this._zoom : zoom;
            return this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
        },

        unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
            zoom = zoom === undefined ? this._zoom : zoom;
            return this.options.crs.pointToLatLng(L.point(point), zoom);
        },

        layerPointToLatLng: function (point) { // (Point)
            var projectedPoint = L.point(point).add(this.getPixelOrigin());
            return this.unproject(projectedPoint);
        },

        latLngToLayerPoint: function (latlng) { // (LatLng)
            var projectedPoint = this.project(L.latLng(latlng))._round();
            return projectedPoint._subtract(this.getPixelOrigin());
        },

        containerPointToLayerPoint: function (point) { // (Point)
            return L.point(point).subtract(this._getMapPanePos());
        },

        layerPointToContainerPoint: function (point) { // (Point)
            return L.point(point).add(this._getMapPanePos());
        },

        containerPointToLatLng: function (point) {
            var layerPoint = this.containerPointToLayerPoint(L.point(point));
            return this.layerPointToLatLng(layerPoint);
        },

        latLngToContainerPoint: function (latlng) {
            return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
        },

        mouseEventToContainerPoint: function (e) { // (MouseEvent)
            return L.DomEvent.getMousePosition(e, this._container);
        },

        mouseEventToLayerPoint: function (e) { // (MouseEvent)
            return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
        },

        mouseEventToLatLng: function (e) { // (MouseEvent)
            return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
        },


        // map initialization methods

        _initContainer: function (id) {
            var container = this._container = L.DomUtil.get(id);

            if (!container) {
                throw new Error('Map container not found.');
            } else if (container._leaflet) {
                throw new Error('Map container is already initialized.');
            }

            container._leaflet = true;
        },

        _initLayout: function () {
            var container = this._container;

            L.DomUtil.addClass(container, 'leaflet-container' +
                (L.Browser.touch ? ' leaflet-touch' : '') +
                (L.Browser.retina ? ' leaflet-retina' : '') +
                (L.Browser.ielt9 ? ' leaflet-oldie' : '') +
                (this.options.fadeAnimation ? ' leaflet-fade-anim' : ''));

            var position = L.DomUtil.getStyle(container, 'position');

            if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
                container.style.position = 'relative';
            }

            this._initPanes();

            if (this._initControlPos) {
                this._initControlPos();
            }
        },

        _initPanes: function () {
            var panes = this._panes = {};

            this._mapPane = panes.mapPane = this._createPane('leaflet-map-pane', this._container);

            this._tilePane = panes.tilePane = this._createPane('leaflet-tile-pane', this._mapPane);
            panes.objectsPane = this._createPane('leaflet-objects-pane', this._mapPane);
            panes.shadowPane = this._createPane('leaflet-shadow-pane');
            panes.overlayPane = this._createPane('leaflet-overlay-pane');
            panes.markerPane = this._createPane('leaflet-marker-pane');
            panes.popupPane = this._createPane('leaflet-popup-pane');

            var zoomHide = ' leaflet-zoom-hide';

            if (!this.options.markerZoomAnimation) {
                L.DomUtil.addClass(panes.markerPane, zoomHide);
                L.DomUtil.addClass(panes.shadowPane, zoomHide);
                L.DomUtil.addClass(panes.popupPane, zoomHide);
            }
        },

        _createPane: function (className, container) {
            return L.DomUtil.create('div', className, container || this._panes.objectsPane);
        },

        _clearPanes: function () {
            this._container.removeChild(this._mapPane);
        },

        _addLayers: function (layers) {
            layers = layers ? (L.Util.isArray(layers) ? layers : [layers]) : [];

            for (var i = 0, len = layers.length; i < len; i++) {
                this.addLayer(layers[i]);
            }
        },


        // private methods that modify map state

        _resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

            var zoomChanged = (this._zoom !== zoom);

            if (!afterZoomAnim) {
                this.fire('movestart');

                if (zoomChanged) {
                    this.fire('zoomstart');
                }
            }

            this._zoom = zoom;
            this._initialCenter = center;

            this._initialTopLeftPoint = this._getNewTopLeftPoint(center);

            if (!preserveMapOffset) {
                L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
            } else {
                this._initialTopLeftPoint._add(this._getMapPanePos());
            }

            this._tileLayersToLoad = this._tileLayersNum;

            var loading = !this._loaded;
            this._loaded = true;

            if (loading) {
                this.fire('load');
                this.eachLayer(this._layerAdd, this);
            }

            this.fire('viewreset', {hard: !preserveMapOffset});

            this.fire('move');

            if (zoomChanged || afterZoomAnim) {
                this.fire('zoomend');
            }

            this.fire('moveend', {hard: !preserveMapOffset});
        },

        _rawPanBy: function (offset) {
            L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
        },

        _getZoomSpan: function () {
            return this.getMaxZoom() - this.getMinZoom();
        },

        _updateZoomLevels: function () {
            var i,
                minZoom = Infinity,
                maxZoom = -Infinity,
                oldZoomSpan = this._getZoomSpan();

            for (i in this._zoomBoundLayers) {
                var layer = this._zoomBoundLayers[i];
                if (!isNaN(layer.options.minZoom)) {
                    minZoom = Math.min(minZoom, layer.options.minZoom);
                }
                if (!isNaN(layer.options.maxZoom)) {
                    maxZoom = Math.max(maxZoom, layer.options.maxZoom);
                }
            }

            if (i === undefined) { // we have no tilelayers
                this._layersMaxZoom = this._layersMinZoom = undefined;
            } else {
                this._layersMaxZoom = maxZoom;
                this._layersMinZoom = minZoom;
            }

            if (oldZoomSpan !== this._getZoomSpan()) {
                this.fire('zoomlevelschange');
            }
        },

        _panInsideMaxBounds: function () {
            this.panInsideBounds(this.options.maxBounds);
        },

        _checkIfLoaded: function () {
            if (!this._loaded) {
                throw new Error('Set map center and zoom first.');
            }
        },

        // map events

        _initEvents: function (onOff) {
            if (!L.DomEvent) { return; }

            onOff = onOff || 'on';

            L.DomEvent[onOff](this._container, 'click', this._onMouseClick, this);

            var events = ['dblclick', 'mousedown', 'mouseup', 'mouseenter',
                          'mouseleave', 'mousemove', 'contextmenu'],
                i, len;

            for (i = 0, len = events.length; i < len; i++) {
                L.DomEvent[onOff](this._container, events[i], this._fireMouseEvent, this);
            }

            if (this.options.trackResize) {
                L.DomEvent[onOff](window, 'resize', this._onResize, this);
            }
        },

        _onResize: function () {
            L.Util.cancelAnimFrame(this._resizeRequest);
            this._resizeRequest = L.Util.requestAnimFrame(
                    function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);
        },

        _onMouseClick: function (e) {
            if (!this._loaded || (!e._simulated &&
                    ((this.dragging && this.dragging.moved()) ||
                     (this.boxZoom  && this.boxZoom.moved()))) ||
                        L.DomEvent._skipped(e)) { return; }

            this.fire('preclick');
            this._fireMouseEvent(e);
        },

        _fireMouseEvent: function (e) {
            if (!this._loaded || L.DomEvent._skipped(e)) { return; }

            var type = e.type;

            type = (type === 'mouseenter' ? 'mouseover' : (type === 'mouseleave' ? 'mouseout' : type));

            if (!this.hasEventListeners(type)) { return; }

            if (type === 'contextmenu') {
                L.DomEvent.preventDefault(e);
            }

            var containerPoint = this.mouseEventToContainerPoint(e),
                layerPoint = this.containerPointToLayerPoint(containerPoint),
                latlng = this.layerPointToLatLng(layerPoint);

            this.fire(type, {
                latlng: latlng,
                layerPoint: layerPoint,
                containerPoint: containerPoint,
                originalEvent: e
            });
        },

        _onTileLayerLoad: function () {
            this._tileLayersToLoad--;
            if (this._tileLayersNum && !this._tileLayersToLoad) {
                this.fire('tilelayersload');
            }
        },

        _clearHandlers: function () {
            for (var i = 0, len = this._handlers.length; i < len; i++) {
                this._handlers[i].disable();
            }
        },

        whenReady: function (callback, context) {
            if (this._loaded) {
                callback.call(context || this, this);
            } else {
                this.on('load', callback, context);
            }
            return this;
        },

        _layerAdd: function (layer) {
            layer.onAdd(this);
            this.fire('layeradd', {layer: layer});
        },


        // private methods for getting map state

        _getMapPanePos: function () {
            return L.DomUtil.getPosition(this._mapPane);
        },

        _moved: function () {
            var pos = this._getMapPanePos();
            return pos && !pos.equals([0, 0]);
        },

        _getTopLeftPoint: function () {
            return this.getPixelOrigin().subtract(this._getMapPanePos());
        },

        _getNewTopLeftPoint: function (center, zoom) {
            var viewHalf = this.getSize()._divideBy(2);
            // TODO round on display, not calculation to increase precision?
            return this.project(center, zoom)._subtract(viewHalf)._round();
        },

        _latLngToNewLayerPoint: function (latlng, newZoom, newCenter) {
            var topLeft = this._getNewTopLeftPoint(newCenter, newZoom).add(this._getMapPanePos());
            return this.project(latlng, newZoom)._subtract(topLeft);
        },

        // layer point of the current center
        _getCenterLayerPoint: function () {
            return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
        },

        // offset of the specified place to the current center in pixels
        _getCenterOffset: function (latlng) {
            return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
        },

        // adjust center for view to get inside bounds
        _limitCenter: function (center, zoom, bounds) {

            if (!bounds) { return center; }

            var centerPoint = this.project(center, zoom),
                viewHalf = this.getSize().divideBy(2),
                viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
                offset = this._getBoundsOffset(viewBounds, bounds, zoom);

            return this.unproject(centerPoint.add(offset), zoom);
        },

        // adjust offset for view to get inside bounds
        _limitOffset: function (offset, bounds) {
            if (!bounds) { return offset; }

            var viewBounds = this.getPixelBounds(),
                newBounds = new L.Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

            return offset.add(this._getBoundsOffset(newBounds, bounds));
        },

        // returns offset needed for pxBounds to get inside maxBounds at a specified zoom
        _getBoundsOffset: function (pxBounds, maxBounds, zoom) {
            var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
                seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

                dx = this._rebound(nwOffset.x, -seOffset.x),
                dy = this._rebound(nwOffset.y, -seOffset.y);

            return new L.Point(dx, dy);
        },

        _rebound: function (left, right) {
            return left + right > 0 ?
                Math.round(left - right) / 2 :
                Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
        },

        _limitZoom: function (zoom) {
            var min = this.getMinZoom(),
                max = this.getMaxZoom();

            return Math.max(min, Math.min(max, zoom));
        }
    });

    L.map = function (id, options) {
        return new L.Map(id, options);
    };


    /*
     * Mercator projection that takes into account that the Earth is not a perfect sphere.
     * Less popular than spherical mercator; used by projections like EPSG:3395.
     */

    L.Projection.Mercator = {
        MAX_LATITUDE: 85.0840591556,

        R_MINOR: 6356752.314245179,
        R_MAJOR: 6378137,

        project: function (latlng) { // (LatLng) -> Point
            var d = L.LatLng.DEG_TO_RAD,
                max = this.MAX_LATITUDE,
                lat = Math.max(Math.min(max, latlng.lat), -max),
                r = this.R_MAJOR,
                r2 = this.R_MINOR,
                x = latlng.lng * d * r,
                y = lat * d,
                tmp = r2 / r,
                eccent = Math.sqrt(1.0 - tmp * tmp),
                con = eccent * Math.sin(y);

            con = Math.pow((1 - con) / (1 + con), eccent * 0.5);

            var ts = Math.tan(0.5 * ((Math.PI * 0.5) - y)) / con;
            y = -r * Math.log(ts);

            return new L.Point(x, y);
        },

        unproject: function (point) { // (Point, Boolean) -> LatLng
            var d = L.LatLng.RAD_TO_DEG,
                r = this.R_MAJOR,
                r2 = this.R_MINOR,
                lng = point.x * d / r,
                tmp = r2 / r,
                eccent = Math.sqrt(1 - (tmp * tmp)),
                ts = Math.exp(- point.y / r),
                phi = (Math.PI / 2) - 2 * Math.atan(ts),
                numIter = 15,
                tol = 1e-7,
                i = numIter,
                dphi = 0.1,
                con;

            while ((Math.abs(dphi) > tol) && (--i > 0)) {
                con = eccent * Math.sin(phi);
                dphi = (Math.PI / 2) - 2 * Math.atan(ts *
                            Math.pow((1.0 - con) / (1.0 + con), 0.5 * eccent)) - phi;
                phi += dphi;
            }

            return new L.LatLng(phi * d, lng);
        }
    };



    L.CRS.EPSG3395 = L.extend({}, L.CRS, {
        code: 'EPSG:3395',

        projection: L.Projection.Mercator,

        transformation: (function () {
            var m = L.Projection.Mercator,
                r = m.R_MAJOR,
                scale = 0.5 / (Math.PI * r);

            return new L.Transformation(scale, 0.5, -scale, 0.5);
        }())
    });


    /*
     * L.TileLayer is used for standard xyz-numbered tile layers.
     */

    L.TileLayer = L.Class.extend({
        includes: L.Mixin.Events,

        options: {
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            subdomains: 'abc',
            errorTileUrl: '',
            attribution: '',
            zoomOffset: 0,
            opacity: 1,
            /*
            maxNativeZoom: null,
            zIndex: null,
            tms: false,
            continuousWorld: false,
            noWrap: false,
            zoomReverse: false,
            detectRetina: false,
            reuseTiles: false,
            bounds: false,
            */
            unloadInvisibleTiles: L.Browser.mobile,
            updateWhenIdle: L.Browser.mobile
        },

        initialize: function (url, options) {
            options = L.setOptions(this, options);

            // detecting retina displays, adjusting tileSize and zoom levels
            if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

                options.tileSize = Math.floor(options.tileSize / 2);
                options.zoomOffset++;

                if (options.minZoom > 0) {
                    options.minZoom--;
                }
                this.options.maxZoom--;
            }

            if (options.bounds) {
                options.bounds = L.latLngBounds(options.bounds);
            }

            this._url = url;

            var subdomains = this.options.subdomains;

            if (typeof subdomains === 'string') {
                this.options.subdomains = subdomains.split('');
            }
        },

        onAdd: function (map) {
            this._map = map;
            this._animated = map._zoomAnimated;

            // create a container div for tiles
            this._initContainer();

            // set up events
            map.on({
                'viewreset': this._reset,
                'moveend': this._update
            }, this);

            if (this._animated) {
                map.on({
                    'zoomanim': this._animateZoom,
                    'zoomend': this._endZoomAnim
                }, this);
            }

            if (!this.options.updateWhenIdle) {
                this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
                map.on('move', this._limitedUpdate, this);
            }

            this._reset();
            this._update();
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        onRemove: function (map) {
            this._container.parentNode.removeChild(this._container);

            map.off({
                'viewreset': this._reset,
                'moveend': this._update
            }, this);

            if (this._animated) {
                map.off({
                    'zoomanim': this._animateZoom,
                    'zoomend': this._endZoomAnim
                }, this);
            }

            if (!this.options.updateWhenIdle) {
                map.off('move', this._limitedUpdate, this);
            }

            this._container = null;
            this._map = null;
        },

        bringToFront: function () {
            var pane = this._map._panes.tilePane;

            if (this._container) {
                pane.appendChild(this._container);
                this._setAutoZIndex(pane, Math.max);
            }

            return this;
        },

        bringToBack: function () {
            var pane = this._map._panes.tilePane;

            if (this._container) {
                pane.insertBefore(this._container, pane.firstChild);
                this._setAutoZIndex(pane, Math.min);
            }

            return this;
        },

        getAttribution: function () {
            return this.options.attribution;
        },

        getContainer: function () {
            return this._container;
        },

        setOpacity: function (opacity) {
            this.options.opacity = opacity;

            if (this._map) {
                this._updateOpacity();
            }

            return this;
        },

        setZIndex: function (zIndex) {
            this.options.zIndex = zIndex;
            this._updateZIndex();

            return this;
        },

        setUrl: function (url, noRedraw) {
            this._url = url;

            if (!noRedraw) {
                this.redraw();
            }

            return this;
        },

        redraw: function () {
            if (this._map) {
                this._reset({hard: true});
                this._update();
            }
            return this;
        },

        _updateZIndex: function () {
            if (this._container && this.options.zIndex !== undefined) {
                this._container.style.zIndex = this.options.zIndex;
            }
        },

        _setAutoZIndex: function (pane, compare) {

            var layers = pane.children,
                edgeZIndex = -compare(Infinity, -Infinity), // -Infinity for max, Infinity for min
                zIndex, i, len;

            for (i = 0, len = layers.length; i < len; i++) {

                if (layers[i] !== this._container) {
                    zIndex = parseInt(layers[i].style.zIndex, 10);

                    if (!isNaN(zIndex)) {
                        edgeZIndex = compare(edgeZIndex, zIndex);
                    }
                }
            }

            this.options.zIndex = this._container.style.zIndex =
                    (isFinite(edgeZIndex) ? edgeZIndex : 0) + compare(1, -1);
        },

        _updateOpacity: function () {
            var i,
                tiles = this._tiles;

            if (L.Browser.ielt9) {
                for (i in tiles) {
                    L.DomUtil.setOpacity(tiles[i], this.options.opacity);
                }
            } else {
                L.DomUtil.setOpacity(this._container, this.options.opacity);
            }
        },

        _initContainer: function () {
            var tilePane = this._map._panes.tilePane;

            if (!this._container) {
                this._container = L.DomUtil.create('div', 'leaflet-layer');

                this._updateZIndex();

                if (this._animated) {
                    var className = 'leaflet-tile-container';

                    this._bgBuffer = L.DomUtil.create('div', className, this._container);
                    this._tileContainer = L.DomUtil.create('div', className, this._container);

                } else {
                    this._tileContainer = this._container;
                }

                tilePane.appendChild(this._container);

                if (this.options.opacity < 1) {
                    this._updateOpacity();
                }
            }
        },

        _reset: function (e) {
            for (var key in this._tiles) {
                this.fire('tileunload', {tile: this._tiles[key]});
            }

            this._tiles = {};
            this._tilesToLoad = 0;

            if (this.options.reuseTiles) {
                this._unusedTiles = [];
            }

            this._tileContainer.innerHTML = '';

            if (this._animated && e && e.hard) {
                this._clearBgBuffer();
            }

            this._initContainer();
        },

        _getTileSize: function () {
            var map = this._map,
                zoom = map.getZoom() + this.options.zoomOffset,
                zoomN = this.options.maxNativeZoom,
                tileSize = this.options.tileSize;

            if (zoomN && zoom > zoomN) {
                tileSize = Math.round(map.getZoomScale(zoom) / map.getZoomScale(zoomN) * tileSize);
            }

            return tileSize;
        },

        _update: function () {

            if (!this._map) { return; }

            var map = this._map,
                bounds = map.getPixelBounds(),
                zoom = map.getZoom(),
                tileSize = this._getTileSize();

            if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
                return;
            }

            var tileBounds = L.bounds(
                    bounds.min.divideBy(tileSize)._floor(),
                    bounds.max.divideBy(tileSize)._floor());

            this._addTilesFromCenterOut(tileBounds);

            if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
                this._removeOtherTiles(tileBounds);
            }
        },

        _addTilesFromCenterOut: function (bounds) {
            var queue = [],
                center = bounds.getCenter();

            var j, i, point;

            for (j = bounds.min.y; j <= bounds.max.y; j++) {
                for (i = bounds.min.x; i <= bounds.max.x; i++) {
                    point = new L.Point(i, j);

                    if (this._tileShouldBeLoaded(point)) {
                        queue.push(point);
                    }
                }
            }

            var tilesToLoad = queue.length;

            if (tilesToLoad === 0) { return; }

            // load tiles in order of their distance to center
            queue.sort(function (a, b) {
                return a.distanceTo(center) - b.distanceTo(center);
            });

            var fragment = document.createDocumentFragment();

            // if its the first batch of tiles to load
            if (!this._tilesToLoad) {
                this.fire('loading');
            }

            this._tilesToLoad += tilesToLoad;

            for (i = 0; i < tilesToLoad; i++) {
                this._addTile(queue[i], fragment);
            }

            this._tileContainer.appendChild(fragment);
        },

        _tileShouldBeLoaded: function (tilePoint) {
            if ((tilePoint.x + ':' + tilePoint.y) in this._tiles) {
                return false; // already loaded
            }

            var options = this.options;

            if (!options.continuousWorld) {
                var limit = this._getWrapTileNum();

                // don't load if exceeds world bounds
                if ((options.noWrap && (tilePoint.x < 0 || tilePoint.x >= limit.x)) ||
                    tilePoint.y < 0 || tilePoint.y >= limit.y) { return false; }
            }

            if (options.bounds) {
                var tileSize = options.tileSize,
                    nwPoint = tilePoint.multiplyBy(tileSize),
                    sePoint = nwPoint.add([tileSize, tileSize]),
                    nw = this._map.unproject(nwPoint),
                    se = this._map.unproject(sePoint);

                // TODO temporary hack, will be removed after refactoring projections
                // https://github.com/Leaflet/Leaflet/issues/1618
                if (!options.continuousWorld && !options.noWrap) {
                    nw = nw.wrap();
                    se = se.wrap();
                }

                if (!options.bounds.intersects([nw, se])) { return false; }
            }

            return true;
        },

        _removeOtherTiles: function (bounds) {
            var kArr, x, y, key;

            for (key in this._tiles) {
                kArr = key.split(':');
                x = parseInt(kArr[0], 10);
                y = parseInt(kArr[1], 10);

                // remove tile if it's out of bounds
                if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
                    this._removeTile(key);
                }
            }
        },

        _removeTile: function (key) {
            var tile = this._tiles[key];

            this.fire('tileunload', {tile: tile, url: tile.src});

            if (this.options.reuseTiles) {
                L.DomUtil.removeClass(tile, 'leaflet-tile-loaded');
                this._unusedTiles.push(tile);

            } else if (tile.parentNode === this._tileContainer) {
                this._tileContainer.removeChild(tile);
            }

            // for https://github.com/CloudMade/Leaflet/issues/137
            if (!L.Browser.android) {
                tile.onload = null;
                tile.src = L.Util.emptyImageUrl;
            }

            delete this._tiles[key];
        },

        _addTile: function (tilePoint, container) {
            var tilePos = this._getTilePos(tilePoint);

            // get unused tile - or create a new tile
            var tile = this._getTile();

            /*
            Chrome 20 layouts much faster with top/left (verify with timeline, frames)
            Android 4 browser has display issues with top/left and requires transform instead
            (other browsers don't currently care) - see debug/hacks/jitter.html for an example
            */
            L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome);

            this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;

            this._loadTile(tile, tilePoint);

            if (tile.parentNode !== this._tileContainer) {
                container.appendChild(tile);
            }
        },

        _getZoomForUrl: function () {

            var options = this.options,
                zoom = this._map.getZoom();

            if (options.zoomReverse) {
                zoom = options.maxZoom - zoom;
            }

            zoom += options.zoomOffset;

            return options.maxNativeZoom ? Math.min(zoom, options.maxNativeZoom) : zoom;
        },

        _getTilePos: function (tilePoint) {
            var origin = this._map.getPixelOrigin(),
                tileSize = this._getTileSize();

            return tilePoint.multiplyBy(tileSize).subtract(origin);
        },

        // image-specific code (override to implement e.g. Canvas or SVG tile layer)

        getTileUrl: function (tilePoint) {
            return L.Util.template(this._url, L.extend({
                s: this._getSubdomain(tilePoint),
                z: tilePoint.z,
                x: tilePoint.x,
                y: tilePoint.y
            }, this.options));
        },

        _getWrapTileNum: function () {
            var crs = this._map.options.crs,
                size = crs.getSize(this._map.getZoom());
            return size.divideBy(this._getTileSize())._floor();
        },

        _adjustTilePoint: function (tilePoint) {

            var limit = this._getWrapTileNum();

            // wrap tile coordinates
            if (!this.options.continuousWorld && !this.options.noWrap) {
                tilePoint.x = ((tilePoint.x % limit.x) + limit.x) % limit.x;
            }

            if (this.options.tms) {
                tilePoint.y = limit.y - tilePoint.y - 1;
            }

            tilePoint.z = this._getZoomForUrl();
        },

        _getSubdomain: function (tilePoint) {
            var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
            return this.options.subdomains[index];
        },

        _getTile: function () {
            if (this.options.reuseTiles && this._unusedTiles.length > 0) {
                var tile = this._unusedTiles.pop();
                this._resetTile(tile);
                return tile;
            }
            return this._createTile();
        },

        // Override if data stored on a tile needs to be cleaned up before reuse
        _resetTile: function (/*tile*/) {},

        _createTile: function () {
            var tile = L.DomUtil.create('img', 'leaflet-tile');
            tile.style.width = tile.style.height = this._getTileSize() + 'px';
            tile.galleryimg = 'no';

            tile.onselectstart = tile.onmousemove = L.Util.falseFn;

            if (L.Browser.ielt9 && this.options.opacity !== undefined) {
                L.DomUtil.setOpacity(tile, this.options.opacity);
            }
            // without this hack, tiles disappear after zoom on Chrome for Android
            // https://github.com/Leaflet/Leaflet/issues/2078
            if (L.Browser.mobileWebkit3d) {
                tile.style.WebkitBackfaceVisibility = 'hidden';
            }
            return tile;
        },

        _loadTile: function (tile, tilePoint) {
            tile._layer  = this;
            tile.onload  = this._tileOnLoad;
            tile.onerror = this._tileOnError;

            this._adjustTilePoint(tilePoint);
            tile.src     = this.getTileUrl(tilePoint);

            this.fire('tileloadstart', {
                tile: tile,
                url: tile.src
            });
        },

        _tileLoaded: function () {
            this._tilesToLoad--;

            if (this._animated) {
                L.DomUtil.addClass(this._tileContainer, 'leaflet-zoom-animated');
            }

            if (!this._tilesToLoad) {
                this.fire('load');

                if (this._animated) {
                    // clear scaled tiles after all new tiles are loaded (for performance)
                    clearTimeout(this._clearBgBufferTimer);
                    this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
                }
            }
        },

        _tileOnLoad: function () {
            var layer = this._layer;

            //Only if we are loading an actual image
            if (this.src !== L.Util.emptyImageUrl) {
                L.DomUtil.addClass(this, 'leaflet-tile-loaded');

                layer.fire('tileload', {
                    tile: this,
                    url: this.src
                });
            }

            layer._tileLoaded();
        },

        _tileOnError: function () {
            var layer = this._layer;

            layer.fire('tileerror', {
                tile: this,
                url: this.src
            });

            var newUrl = layer.options.errorTileUrl;
            if (newUrl) {
                this.src = newUrl;
            }

            layer._tileLoaded();
        }
    });

    L.tileLayer = function (url, options) {
        return new L.TileLayer(url, options);
    };


    /*
     * L.TileLayer.WMS is used for putting WMS tile layers on the map.
     */

    L.TileLayer.WMS = L.TileLayer.extend({

        defaultWmsParams: {
            service: 'WMS',
            request: 'GetMap',
            version: '1.1.1',
            layers: '',
            styles: '',
            format: 'image/jpeg',
            transparent: false
        },

        initialize: function (url, options) { // (String, Object)

            this._url = url;

            var wmsParams = L.extend({}, this.defaultWmsParams),
                tileSize = options.tileSize || this.options.tileSize;

            if (options.detectRetina && L.Browser.retina) {
                wmsParams.width = wmsParams.height = tileSize * 2;
            } else {
                wmsParams.width = wmsParams.height = tileSize;
            }

            for (var i in options) {
                // all keys that are not TileLayer options go to WMS params
                if (!this.options.hasOwnProperty(i) && i !== 'crs') {
                    wmsParams[i] = options[i];
                }
            }

            this.wmsParams = wmsParams;

            L.setOptions(this, options);
        },

        onAdd: function (map) {

            this._crs = this.options.crs || map.options.crs;

            this._wmsVersion = parseFloat(this.wmsParams.version);

            var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
            this.wmsParams[projectionKey] = this._crs.code;

            L.TileLayer.prototype.onAdd.call(this, map);
        },

        getTileUrl: function (tilePoint) { // (Point, Number) -> String

            var map = this._map,
                tileSize = this.options.tileSize,

                nwPoint = tilePoint.multiplyBy(tileSize),
                sePoint = nwPoint.add([tileSize, tileSize]),

                nw = this._crs.project(map.unproject(nwPoint, tilePoint.z)),
                se = this._crs.project(map.unproject(sePoint, tilePoint.z)),
                bbox = this._wmsVersion >= 1.3 && this._crs === L.CRS.EPSG4326 ?
                    [se.y, nw.x, nw.y, se.x].join(',') :
                    [nw.x, se.y, se.x, nw.y].join(','),

                url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});

            return url + L.Util.getParamString(this.wmsParams, url, true) + '&BBOX=' + bbox;
        },

        setParams: function (params, noRedraw) {

            L.extend(this.wmsParams, params);

            if (!noRedraw) {
                this.redraw();
            }

            return this;
        }
    });

    L.tileLayer.wms = function (url, options) {
        return new L.TileLayer.WMS(url, options);
    };


    /*
     * L.TileLayer.Canvas is a class that you can use as a base for creating
     * dynamically drawn Canvas-based tile layers.
     */

    L.TileLayer.Canvas = L.TileLayer.extend({
        options: {
            async: false
        },

        initialize: function (options) {
            L.setOptions(this, options);
        },

        redraw: function () {
            if (this._map) {
                this._reset({hard: true});
                this._update();
            }

            for (var i in this._tiles) {
                this._redrawTile(this._tiles[i]);
            }
            return this;
        },

        _redrawTile: function (tile) {
            this.drawTile(tile, tile._tilePoint, this._map._zoom);
        },

        _createTile: function () {
            var tile = L.DomUtil.create('canvas', 'leaflet-tile');
            tile.width = tile.height = this.options.tileSize;
            tile.onselectstart = tile.onmousemove = L.Util.falseFn;
            return tile;
        },

        _loadTile: function (tile, tilePoint) {
            tile._layer = this;
            tile._tilePoint = tilePoint;

            this._redrawTile(tile);

            if (!this.options.async) {
                this.tileDrawn(tile);
            }
        },

        drawTile: function (/*tile, tilePoint*/) {
            // override with rendering code
        },

        tileDrawn: function (tile) {
            this._tileOnLoad.call(tile);
        }
    });


    L.tileLayer.canvas = function (options) {
        return new L.TileLayer.Canvas(options);
    };


    /*
     * L.ImageOverlay is used to overlay images over the map (to specific geographical bounds).
     */

    L.ImageOverlay = L.Class.extend({
        includes: L.Mixin.Events,

        options: {
            opacity: 1
        },

        initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
            this._url = url;
            this._bounds = L.latLngBounds(bounds);

            L.setOptions(this, options);
        },

        onAdd: function (map) {
            this._map = map;

            if (!this._image) {
                this._initImage();
            }

            map._panes.overlayPane.appendChild(this._image);

            map.on('viewreset', this._reset, this);

            if (map.options.zoomAnimation && L.Browser.any3d) {
                map.on('zoomanim', this._animateZoom, this);
            }

            this._reset();
        },

        onRemove: function (map) {
            map.getPanes().overlayPane.removeChild(this._image);

            map.off('viewreset', this._reset, this);

            if (map.options.zoomAnimation) {
                map.off('zoomanim', this._animateZoom, this);
            }
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        setOpacity: function (opacity) {
            this.options.opacity = opacity;
            this._updateOpacity();
            return this;
        },

        // TODO remove bringToFront/bringToBack duplication from TileLayer/Path
        bringToFront: function () {
            if (this._image) {
                this._map._panes.overlayPane.appendChild(this._image);
            }
            return this;
        },

        bringToBack: function () {
            var pane = this._map._panes.overlayPane;
            if (this._image) {
                pane.insertBefore(this._image, pane.firstChild);
            }
            return this;
        },

        setUrl: function (url) {
            this._url = url;
            this._image.src = this._url;
        },

        getAttribution: function () {
            return this.options.attribution;
        },

        _initImage: function () {
            this._image = L.DomUtil.create('img', 'leaflet-image-layer');

            if (this._map.options.zoomAnimation && L.Browser.any3d) {
                L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
            } else {
                L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
            }

            this._updateOpacity();

            //TODO createImage util method to remove duplication
            L.extend(this._image, {
                galleryimg: 'no',
                onselectstart: L.Util.falseFn,
                onmousemove: L.Util.falseFn,
                onload: L.bind(this._onImageLoad, this),
                src: this._url
            });
        },

        _animateZoom: function (e) {
            var map = this._map,
                image = this._image,
                scale = map.getZoomScale(e.zoom),
                nw = this._bounds.getNorthWest(),
                se = this._bounds.getSouthEast(),

                topLeft = map._latLngToNewLayerPoint(nw, e.zoom, e.center),
                size = map._latLngToNewLayerPoint(se, e.zoom, e.center)._subtract(topLeft),
                origin = topLeft._add(size._multiplyBy((1 / 2) * (1 - 1 / scale)));

            image.style[L.DomUtil.TRANSFORM] =
                    L.DomUtil.getTranslateString(origin) + ' scale(' + scale + ') ';
        },

        _reset: function () {
            var image   = this._image,
                topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
                size = this._map.latLngToLayerPoint(this._bounds.getSouthEast())._subtract(topLeft);

            L.DomUtil.setPosition(image, topLeft);

            image.style.width  = size.x + 'px';
            image.style.height = size.y + 'px';
        },

        _onImageLoad: function () {
            this.fire('load');
        },

        _updateOpacity: function () {
            L.DomUtil.setOpacity(this._image, this.options.opacity);
        }
    });

    L.imageOverlay = function (url, bounds, options) {
        return new L.ImageOverlay(url, bounds, options);
    };


    /*
     * L.Icon is an image-based icon class that you can use with L.Marker for custom markers.
     */

    L.Icon = L.Class.extend({
        options: {
            /*
            iconUrl: (String) (required)
            iconRetinaUrl: (String) (optional, used for retina devices if detected)
            iconSize: (Point) (can be set through CSS)
            iconAnchor: (Point) (centered by default, can be set in CSS with negative margins)
            popupAnchor: (Point) (if not specified, popup opens in the anchor point)
            shadowUrl: (String) (no shadow by default)
            shadowRetinaUrl: (String) (optional, used for retina devices if detected)
            shadowSize: (Point)
            shadowAnchor: (Point)
            */
            className: ''
        },

        initialize: function (options) {
            L.setOptions(this, options);
        },

        createIcon: function (oldIcon) {
            return this._createIcon('icon', oldIcon);
        },

        createShadow: function (oldIcon) {
            return this._createIcon('shadow', oldIcon);
        },

        _createIcon: function (name, oldIcon) {
            var src = this._getIconUrl(name);

            if (!src) {
                if (name === 'icon') {
                    throw new Error('iconUrl not set in Icon options (see the docs).');
                }
                return null;
            }

            var img;
            if (!oldIcon || oldIcon.tagName !== 'IMG') {
                img = this._createImg(src);
            } else {
                img = this._createImg(src, oldIcon);
            }
            this._setIconStyles(img, name);

            return img;
        },

        _setIconStyles: function (img, name) {
            var options = this.options,
                size = L.point(options[name + 'Size']),
                anchor;

            if (name === 'shadow') {
                anchor = L.point(options.shadowAnchor || options.iconAnchor);
            } else {
                anchor = L.point(options.iconAnchor);
            }

            if (!anchor && size) {
                anchor = size.divideBy(2, true);
            }

            img.className = 'leaflet-marker-' + name + ' ' + options.className;

            if (anchor) {
                img.style.marginLeft = (-anchor.x) + 'px';
                img.style.marginTop  = (-anchor.y) + 'px';
            }

            if (size) {
                img.style.width  = size.x + 'px';
                img.style.height = size.y + 'px';
            }
        },

        _createImg: function (src, el) {
            el = el || document.createElement('img');
            el.src = src;
            return el;
        },

        _getIconUrl: function (name) {
            if (L.Browser.retina && this.options[name + 'RetinaUrl']) {
                return this.options[name + 'RetinaUrl'];
            }
            return this.options[name + 'Url'];
        }
    });

    L.icon = function (options) {
        return new L.Icon(options);
    };


    /*
     * L.Icon.Default is the blue marker icon used by default in Leaflet.
     */

    L.Icon.Default = L.Icon.extend({

        options: {
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],

            shadowSize: [41, 41]
        },

        _getIconUrl: function (name) {
            var key = name + 'Url';

            if (this.options[key]) {
                return this.options[key];
            }

            if (L.Browser.retina && name === 'icon') {
                name += '-2x';
            }

            var path = L.Icon.Default.imagePath;

            if (!path) {
                throw new Error('Couldn\'t autodetect L.Icon.Default.imagePath, set it manually.');
            }

            return path + '/marker-' + name + '.png';
        }
    });

    L.Icon.Default.imagePath = (function () {
        var scripts = document.getElementsByTagName('script'),
            leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

        var i, len, src, matches, path;

        for (i = 0, len = scripts.length; i < len; i++) {
            src = scripts[i].src;
            matches = src.match(leafletRe);

            if (matches) {
                path = src.split(leafletRe)[0];
                return (path ? path + '/' : '') + 'images';
            }
        }
    }());


    /*
     * L.Marker is used to display clickable/draggable icons on the map.
     */

    L.Marker = L.Class.extend({

        includes: L.Mixin.Events,

        options: {
            icon: new L.Icon.Default(),
            title: '',
            alt: '',
            clickable: true,
            draggable: false,
            keyboard: true,
            zIndexOffset: 0,
            opacity: 1,
            riseOnHover: false,
            riseOffset: 250
        },

        initialize: function (latlng, options) {
            L.setOptions(this, options);
            this._latlng = L.latLng(latlng);
        },

        onAdd: function (map) {
            this._map = map;

            map.on('viewreset', this.update, this);

            this._initIcon();
            this.update();
            this.fire('add');

            if (map.options.zoomAnimation && map.options.markerZoomAnimation) {
                map.on('zoomanim', this._animateZoom, this);
            }
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        onRemove: function (map) {
            if (this.dragging) {
                this.dragging.disable();
            }

            this._removeIcon();
            this._removeShadow();

            this.fire('remove');

            map.off({
                'viewreset': this.update,
                'zoomanim': this._animateZoom
            }, this);

            this._map = null;
        },

        getLatLng: function () {
            return this._latlng;
        },

        setLatLng: function (latlng) {
            this._latlng = L.latLng(latlng);

            this.update();

            return this.fire('move', { latlng: this._latlng });
        },

        setZIndexOffset: function (offset) {
            this.options.zIndexOffset = offset;
            this.update();

            return this;
        },

        setIcon: function (icon) {

            this.options.icon = icon;

            if (this._map) {
                this._initIcon();
                this.update();
            }

            if (this._popup) {
                this.bindPopup(this._popup);
            }

            return this;
        },

        update: function () {
            if (this._icon) {
                var pos = this._map.latLngToLayerPoint(this._latlng).round();
                this._setPos(pos);
            }

            return this;
        },

        _initIcon: function () {
            var options = this.options,
                map = this._map,
                animation = (map.options.zoomAnimation && map.options.markerZoomAnimation),
                classToAdd = animation ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide';

            var icon = options.icon.createIcon(this._icon),
                addIcon = false;

            // if we're not reusing the icon, remove the old one and init new one
            if (icon !== this._icon) {
                if (this._icon) {
                    this._removeIcon();
                }
                addIcon = true;

                if (options.title) {
                    icon.title = options.title;
                }

                if (options.alt) {
                    icon.alt = options.alt;
                }
            }

            L.DomUtil.addClass(icon, classToAdd);

            if (options.keyboard) {
                icon.tabIndex = '0';
            }

            this._icon = icon;

            this._initInteraction();

            if (options.riseOnHover) {
                L.DomEvent
                    .on(icon, 'mouseover', this._bringToFront, this)
                    .on(icon, 'mouseout', this._resetZIndex, this);
            }

            var newShadow = options.icon.createShadow(this._shadow),
                addShadow = false;

            if (newShadow !== this._shadow) {
                this._removeShadow();
                addShadow = true;
            }

            if (newShadow) {
                L.DomUtil.addClass(newShadow, classToAdd);
            }
            this._shadow = newShadow;


            if (options.opacity < 1) {
                this._updateOpacity();
            }


            var panes = this._map._panes;

            if (addIcon) {
                panes.markerPane.appendChild(this._icon);
            }

            if (newShadow && addShadow) {
                panes.shadowPane.appendChild(this._shadow);
            }
        },

        _removeIcon: function () {
            if (this.options.riseOnHover) {
                L.DomEvent
                    .off(this._icon, 'mouseover', this._bringToFront)
                    .off(this._icon, 'mouseout', this._resetZIndex);
            }

            this._map._panes.markerPane.removeChild(this._icon);

            this._icon = null;
        },

        _removeShadow: function () {
            if (this._shadow) {
                this._map._panes.shadowPane.removeChild(this._shadow);
            }
            this._shadow = null;
        },

        _setPos: function (pos) {
            L.DomUtil.setPosition(this._icon, pos);

            if (this._shadow) {
                L.DomUtil.setPosition(this._shadow, pos);
            }

            this._zIndex = pos.y + this.options.zIndexOffset;

            this._resetZIndex();
        },

        _updateZIndex: function (offset) {
            this._icon.style.zIndex = this._zIndex + offset;
        },

        _animateZoom: function (opt) {
            var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

            this._setPos(pos);
        },

        _initInteraction: function () {

            if (!this.options.clickable) { return; }

            // TODO refactor into something shared with Map/Path/etc. to DRY it up

            var icon = this._icon,
                events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];

            L.DomUtil.addClass(icon, 'leaflet-clickable');
            L.DomEvent.on(icon, 'click', this._onMouseClick, this);
            L.DomEvent.on(icon, 'keypress', this._onKeyPress, this);

            for (var i = 0; i < events.length; i++) {
                L.DomEvent.on(icon, events[i], this._fireMouseEvent, this);
            }

            if (L.Handler.MarkerDrag) {
                this.dragging = new L.Handler.MarkerDrag(this);

                if (this.options.draggable) {
                    this.dragging.enable();
                }
            }
        },

        _onMouseClick: function (e) {
            var wasDragged = this.dragging && this.dragging.moved();

            if (this.hasEventListeners(e.type) || wasDragged) {
                L.DomEvent.stopPropagation(e);
            }

            if (wasDragged) { return; }

            if ((!this.dragging || !this.dragging._enabled) && this._map.dragging && this._map.dragging.moved()) { return; }

            this.fire(e.type, {
                originalEvent: e,
                latlng: this._latlng
            });
        },

        _onKeyPress: function (e) {
            if (e.keyCode === 13) {
                this.fire('click', {
                    originalEvent: e,
                    latlng: this._latlng
                });
            }
        },

        _fireMouseEvent: function (e) {

            this.fire(e.type, {
                originalEvent: e,
                latlng: this._latlng
            });

            // TODO proper custom event propagation
            // this line will always be called if marker is in a FeatureGroup
            if (e.type === 'contextmenu' && this.hasEventListeners(e.type)) {
                L.DomEvent.preventDefault(e);
            }
            if (e.type !== 'mousedown') {
                L.DomEvent.stopPropagation(e);
            } else {
                L.DomEvent.preventDefault(e);
            }
        },

        setOpacity: function (opacity) {
            this.options.opacity = opacity;
            if (this._map) {
                this._updateOpacity();
            }

            return this;
        },

        _updateOpacity: function () {
            L.DomUtil.setOpacity(this._icon, this.options.opacity);
            if (this._shadow) {
                L.DomUtil.setOpacity(this._shadow, this.options.opacity);
            }
        },

        _bringToFront: function () {
            this._updateZIndex(this.options.riseOffset);
        },

        _resetZIndex: function () {
            this._updateZIndex(0);
        }
    });

    L.marker = function (latlng, options) {
        return new L.Marker(latlng, options);
    };


    /*
     * L.DivIcon is a lightweight HTML-based icon class (as opposed to the image-based L.Icon)
     * to use with L.Marker.
     */

    L.DivIcon = L.Icon.extend({
        options: {
            iconSize: [12, 12], // also can be set through CSS
            /*
            iconAnchor: (Point)
            popupAnchor: (Point)
            html: (String)
            bgPos: (Point)
            */
            className: 'leaflet-div-icon',
            html: false
        },

        createIcon: function (oldIcon) {
            var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
                options = this.options;

            if (options.html !== false) {
                div.innerHTML = options.html;
            } else {
                div.innerHTML = '';
            }

            if (options.bgPos) {
                div.style.backgroundPosition =
                        (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
            }

            this._setIconStyles(div, 'icon');
            return div;
        },

        createShadow: function () {
            return null;
        }
    });

    L.divIcon = function (options) {
        return new L.DivIcon(options);
    };


    /*
     * L.Popup is used for displaying popups on the map.
     */

    L.Map.mergeOptions({
        closePopupOnClick: true
    });

    L.Popup = L.Class.extend({
        includes: L.Mixin.Events,

        options: {
            minWidth: 50,
            maxWidth: 300,
            // maxHeight: null,
            autoPan: true,
            closeButton: true,
            offset: [0, 7],
            autoPanPadding: [5, 5],
            // autoPanPaddingTopLeft: null,
            // autoPanPaddingBottomRight: null,
            keepInView: false,
            className: '',
            zoomAnimation: true
        },

        initialize: function (options, source) {
            L.setOptions(this, options);

            this._source = source;
            this._animated = L.Browser.any3d && this.options.zoomAnimation;
            this._isOpen = false;
        },

        onAdd: function (map) {
            this._map = map;

            if (!this._container) {
                this._initLayout();
            }

            var animFade = map.options.fadeAnimation;

            if (animFade) {
                L.DomUtil.setOpacity(this._container, 0);
            }
            map._panes.popupPane.appendChild(this._container);

            map.on(this._getEvents(), this);

            this.update();

            if (animFade) {
                L.DomUtil.setOpacity(this._container, 1);
            }

            this.fire('open');

            map.fire('popupopen', {popup: this});

            if (this._source) {
                this._source.fire('popupopen', {popup: this});
            }
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        openOn: function (map) {
            map.openPopup(this);
            return this;
        },

        onRemove: function (map) {
            map._panes.popupPane.removeChild(this._container);

            L.Util.falseFn(this._container.offsetWidth); // force reflow

            map.off(this._getEvents(), this);

            if (map.options.fadeAnimation) {
                L.DomUtil.setOpacity(this._container, 0);
            }

            this._map = null;

            this.fire('close');

            map.fire('popupclose', {popup: this});

            if (this._source) {
                this._source.fire('popupclose', {popup: this});
            }
        },

        getLatLng: function () {
            return this._latlng;
        },

        setLatLng: function (latlng) {
            this._latlng = L.latLng(latlng);
            if (this._map) {
                this._updatePosition();
                this._adjustPan();
            }
            return this;
        },

        getContent: function () {
            return this._content;
        },

        setContent: function (content) {
            this._content = content;
            this.update();
            return this;
        },

        update: function () {
            if (!this._map) { return; }

            this._container.style.visibility = 'hidden';

            this._updateContent();
            this._updateLayout();
            this._updatePosition();

            this._container.style.visibility = '';

            this._adjustPan();
        },

        _getEvents: function () {
            var events = {
                viewreset: this._updatePosition
            };

            if (this._animated) {
                events.zoomanim = this._zoomAnimation;
            }
            if ('closeOnClick' in this.options ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
                events.preclick = this._close;
            }
            if (this.options.keepInView) {
                events.moveend = this._adjustPan;
            }

            return events;
        },

        _close: function () {
            if (this._map) {
                this._map.closePopup(this);
            }
        },

        _initLayout: function () {
            var prefix = 'leaflet-popup',
                containerClass = prefix + ' ' + this.options.className + ' leaflet-zoom-' +
                        (this._animated ? 'animated' : 'hide'),
                container = this._container = L.DomUtil.create('div', containerClass),
                closeButton;

            if (this.options.closeButton) {
                closeButton = this._closeButton =
                        L.DomUtil.create('a', prefix + '-close-button', container);
                closeButton.href = '#close';
                closeButton.innerHTML = '&#215;';
                L.DomEvent.disableClickPropagation(closeButton);

                L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);
            }

            var wrapper = this._wrapper =
                    L.DomUtil.create('div', prefix + '-content-wrapper', container);
            L.DomEvent.disableClickPropagation(wrapper);

            this._contentNode = L.DomUtil.create('div', prefix + '-content', wrapper);

            L.DomEvent.disableScrollPropagation(this._contentNode);
            L.DomEvent.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

            this._tipContainer = L.DomUtil.create('div', prefix + '-tip-container', container);
            this._tip = L.DomUtil.create('div', prefix + '-tip', this._tipContainer);
        },

        _updateContent: function () {
            if (!this._content) { return; }

            if (typeof this._content === 'string') {
                this._contentNode.innerHTML = this._content;
            } else {
                while (this._contentNode.hasChildNodes()) {
                    this._contentNode.removeChild(this._contentNode.firstChild);
                }
                this._contentNode.appendChild(this._content);
            }
            this.fire('contentupdate');
        },

        _updateLayout: function () {
            var container = this._contentNode,
                style = container.style;

            style.width = '';
            style.whiteSpace = 'nowrap';

            var width = container.offsetWidth;
            width = Math.min(width, this.options.maxWidth);
            width = Math.max(width, this.options.minWidth);

            style.width = (width + 1) + 'px';
            style.whiteSpace = '';

            style.height = '';

            var height = container.offsetHeight,
                maxHeight = this.options.maxHeight,
                scrolledClass = 'leaflet-popup-scrolled';

            if (maxHeight && height > maxHeight) {
                style.height = maxHeight + 'px';
                L.DomUtil.addClass(container, scrolledClass);
            } else {
                L.DomUtil.removeClass(container, scrolledClass);
            }

            this._containerWidth = this._container.offsetWidth;
        },

        _updatePosition: function () {
            if (!this._map) { return; }

            var pos = this._map.latLngToLayerPoint(this._latlng),
                animated = this._animated,
                offset = L.point(this.options.offset);

            if (animated) {
                L.DomUtil.setPosition(this._container, pos);
            }

            this._containerBottom = -offset.y - (animated ? 0 : pos.y);
            this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x + (animated ? 0 : pos.x);

            // bottom position the popup in case the height of the popup changes (images loading etc)
            this._container.style.bottom = this._containerBottom + 'px';
            this._container.style.left = this._containerLeft + 'px';
        },

        _zoomAnimation: function (opt) {
            var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center);

            L.DomUtil.setPosition(this._container, pos);
        },

        _adjustPan: function () {
            if (!this.options.autoPan) { return; }

            var map = this._map,
                containerHeight = this._container.offsetHeight,
                containerWidth = this._containerWidth,

                layerPos = new L.Point(this._containerLeft, -containerHeight - this._containerBottom);

            if (this._animated) {
                layerPos._add(L.DomUtil.getPosition(this._container));
            }

            var containerPos = map.layerPointToContainerPoint(layerPos),
                padding = L.point(this.options.autoPanPadding),
                paddingTL = L.point(this.options.autoPanPaddingTopLeft || padding),
                paddingBR = L.point(this.options.autoPanPaddingBottomRight || padding),
                size = map.getSize(),
                dx = 0,
                dy = 0;

            if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
                dx = containerPos.x + containerWidth - size.x + paddingBR.x;
            }
            if (containerPos.x - dx - paddingTL.x < 0) { // left
                dx = containerPos.x - paddingTL.x;
            }
            if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
                dy = containerPos.y + containerHeight - size.y + paddingBR.y;
            }
            if (containerPos.y - dy - paddingTL.y < 0) { // top
                dy = containerPos.y - paddingTL.y;
            }

            if (dx || dy) {
                map
                    .fire('autopanstart')
                    .panBy([dx, dy]);
            }
        },

        _onCloseButtonClick: function (e) {
            this._close();
            L.DomEvent.stop(e);
        }
    });

    L.popup = function (options, source) {
        return new L.Popup(options, source);
    };


    L.Map.include({
        openPopup: function (popup, latlng, options) { // (Popup) or (String || HTMLElement, LatLng[, Object])
            this.closePopup();

            if (!(popup instanceof L.Popup)) {
                var content = popup;

                popup = new L.Popup(options)
                    .setLatLng(latlng)
                    .setContent(content);
            }
            popup._isOpen = true;

            this._popup = popup;
            return this.addLayer(popup);
        },

        closePopup: function (popup) {
            if (!popup || popup === this._popup) {
                popup = this._popup;
                this._popup = null;
            }
            if (popup) {
                this.removeLayer(popup);
                popup._isOpen = false;
            }
            return this;
        }
    });


    /*
     * Popup extension to L.Marker, adding popup-related methods.
     */

    L.Marker.include({
        openPopup: function () {
            if (this._popup && this._map && !this._map.hasLayer(this._popup)) {
                this._popup.setLatLng(this._latlng);
                this._map.openPopup(this._popup);
            }

            return this;
        },

        closePopup: function () {
            if (this._popup) {
                this._popup._close();
            }
            return this;
        },

        togglePopup: function () {
            if (this._popup) {
                if (this._popup._isOpen) {
                    this.closePopup();
                } else {
                    this.openPopup();
                }
            }
            return this;
        },

        bindPopup: function (content, options) {
            var anchor = L.point(this.options.icon.options.popupAnchor || [0, 0]);

            anchor = anchor.add(L.Popup.prototype.options.offset);

            if (options && options.offset) {
                anchor = anchor.add(options.offset);
            }

            options = L.extend({offset: anchor}, options);

            if (!this._popupHandlersAdded) {
                this
                    .on('click', this.togglePopup, this)
                    .on('remove', this.closePopup, this)
                    .on('move', this._movePopup, this);
                this._popupHandlersAdded = true;
            }

            if (content instanceof L.Popup) {
                L.setOptions(content, options);
                this._popup = content;
            } else {
                this._popup = new L.Popup(options, this)
                    .setContent(content);
            }

            return this;
        },

        setPopupContent: function (content) {
            if (this._popup) {
                this._popup.setContent(content);
            }
            return this;
        },

        unbindPopup: function () {
            if (this._popup) {
                this._popup = null;
                this
                    .off('click', this.togglePopup, this)
                    .off('remove', this.closePopup, this)
                    .off('move', this._movePopup, this);
                this._popupHandlersAdded = false;
            }
            return this;
        },

        getPopup: function () {
            return this._popup;
        },

        _movePopup: function (e) {
            this._popup.setLatLng(e.latlng);
        }
    });


    /*
     * L.LayerGroup is a class to combine several layers into one so that
     * you can manipulate the group (e.g. add/remove it) as one layer.
     */

    L.LayerGroup = L.Class.extend({
        initialize: function (layers) {
            this._layers = {};

            var i, len;

            if (layers) {
                for (i = 0, len = layers.length; i < len; i++) {
                    this.addLayer(layers[i]);
                }
            }
        },

        addLayer: function (layer) {
            var id = this.getLayerId(layer);

            this._layers[id] = layer;

            if (this._map) {
                this._map.addLayer(layer);
            }

            return this;
        },

        removeLayer: function (layer) {
            var id = layer in this._layers ? layer : this.getLayerId(layer);

            if (this._map && this._layers[id]) {
                this._map.removeLayer(this._layers[id]);
            }

            delete this._layers[id];

            return this;
        },

        hasLayer: function (layer) {
            if (!layer) { return false; }

            return (layer in this._layers || this.getLayerId(layer) in this._layers);
        },

        clearLayers: function () {
            this.eachLayer(this.removeLayer, this);
            return this;
        },

        invoke: function (methodName) {
            var args = Array.prototype.slice.call(arguments, 1),
                i, layer;

            for (i in this._layers) {
                layer = this._layers[i];

                if (layer[methodName]) {
                    layer[methodName].apply(layer, args);
                }
            }

            return this;
        },

        onAdd: function (map) {
            this._map = map;
            this.eachLayer(map.addLayer, map);
        },

        onRemove: function (map) {
            this.eachLayer(map.removeLayer, map);
            this._map = null;
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        eachLayer: function (method, context) {
            for (var i in this._layers) {
                method.call(context, this._layers[i]);
            }
            return this;
        },

        getLayer: function (id) {
            return this._layers[id];
        },

        getLayers: function () {
            var layers = [];

            for (var i in this._layers) {
                layers.push(this._layers[i]);
            }
            return layers;
        },

        setZIndex: function (zIndex) {
            return this.invoke('setZIndex', zIndex);
        },

        getLayerId: function (layer) {
            return L.stamp(layer);
        }
    });

    L.layerGroup = function (layers) {
        return new L.LayerGroup(layers);
    };


    /*
     * L.FeatureGroup extends L.LayerGroup by introducing mouse events and additional methods
     * shared between a group of interactive layers (like vectors or markers).
     */

    L.FeatureGroup = L.LayerGroup.extend({
        includes: L.Mixin.Events,

        statics: {
            EVENTS: 'click dblclick mouseover mouseout mousemove contextmenu popupopen popupclose'
        },

        addLayer: function (layer) {
            if (this.hasLayer(layer)) {
                return this;
            }

            if ('on' in layer) {
                layer.on(L.FeatureGroup.EVENTS, this._propagateEvent, this);
            }

            L.LayerGroup.prototype.addLayer.call(this, layer);

            if (this._popupContent && layer.bindPopup) {
                layer.bindPopup(this._popupContent, this._popupOptions);
            }

            return this.fire('layeradd', {layer: layer});
        },

        removeLayer: function (layer) {
            if (!this.hasLayer(layer)) {
                return this;
            }
            if (layer in this._layers) {
                layer = this._layers[layer];
            }

            layer.off(L.FeatureGroup.EVENTS, this._propagateEvent, this);

            L.LayerGroup.prototype.removeLayer.call(this, layer);

            if (this._popupContent) {
                this.invoke('unbindPopup');
            }

            return this.fire('layerremove', {layer: layer});
        },

        bindPopup: function (content, options) {
            this._popupContent = content;
            this._popupOptions = options;
            return this.invoke('bindPopup', content, options);
        },

        openPopup: function (latlng) {
            // open popup on the first layer
            for (var id in this._layers) {
                this._layers[id].openPopup(latlng);
                break;
            }
            return this;
        },

        setStyle: function (style) {
            return this.invoke('setStyle', style);
        },

        bringToFront: function () {
            return this.invoke('bringToFront');
        },

        bringToBack: function () {
            return this.invoke('bringToBack');
        },

        getBounds: function () {
            var bounds = new L.LatLngBounds();

            this.eachLayer(function (layer) {
                bounds.extend(layer instanceof L.Marker ? layer.getLatLng() : layer.getBounds());
            });

            return bounds;
        },

        _propagateEvent: function (e) {
            e = L.extend({
                layer: e.target,
                target: this
            }, e);
            this.fire(e.type, e);
        }
    });

    L.featureGroup = function (layers) {
        return new L.FeatureGroup(layers);
    };


    /*
     * L.Path is a base class for rendering vector paths on a map. Inherited by Polyline, Circle, etc.
     */

    L.Path = L.Class.extend({
        includes: [L.Mixin.Events],

        statics: {
            // how much to extend the clip area around the map view
            // (relative to its size, e.g. 0.5 is half the screen in each direction)
            // set it so that SVG element doesn't exceed 1280px (vectors flicker on dragend if it is)
            CLIP_PADDING: (function () {
                var max = L.Browser.mobile ? 1280 : 2000,
                    target = (max / Math.max(window.outerWidth, window.outerHeight) - 1) / 2;
                return Math.max(0, Math.min(0.5, target));
            })()
        },

        options: {
            stroke: true,
            color: '#0033ff',
            dashArray: null,
            lineCap: null,
            lineJoin: null,
            weight: 5,
            opacity: 0.5,

            fill: false,
            fillColor: null, //same as color by default
            fillOpacity: 0.2,

            clickable: true
        },

        initialize: function (options) {
            L.setOptions(this, options);
        },

        onAdd: function (map) {
            this._map = map;

            if (!this._container) {
                this._initElements();
                this._initEvents();
            }

            this.projectLatlngs();
            this._updatePath();

            if (this._container) {
                this._map._pathRoot.appendChild(this._container);
            }

            this.fire('add');

            map.on({
                'viewreset': this.projectLatlngs,
                'moveend': this._updatePath
            }, this);
        },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        onRemove: function (map) {
            map._pathRoot.removeChild(this._container);

            // Need to fire remove event before we set _map to null as the event hooks might need the object
            this.fire('remove');
            this._map = null;

            if (L.Browser.vml) {
                this._container = null;
                this._stroke = null;
                this._fill = null;
            }

            map.off({
                'viewreset': this.projectLatlngs,
                'moveend': this._updatePath
            }, this);
        },

        projectLatlngs: function () {
            // do all projection stuff here
        },

        setStyle: function (style) {
            L.setOptions(this, style);

            if (this._container) {
                this._updateStyle();
            }

            return this;
        },

        redraw: function () {
            if (this._map) {
                this.projectLatlngs();
                this._updatePath();
            }
            return this;
        }
    });

    L.Map.include({
        _updatePathViewport: function () {
            var p = L.Path.CLIP_PADDING,
                size = this.getSize(),
                panePos = L.DomUtil.getPosition(this._mapPane),
                min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round()),
                max = min.add(size.multiplyBy(1 + p * 2)._round());

            this._pathViewport = new L.Bounds(min, max);
        }
    });


    /*
     * Extends L.Path with SVG-specific rendering code.
     */

    L.Path.SVG_NS = 'http://www.w3.org/2000/svg';

    L.Browser.svg = !!(document.createElementNS && document.createElementNS(L.Path.SVG_NS, 'svg').createSVGRect);

    L.Path = L.Path.extend({
        statics: {
            SVG: L.Browser.svg
        },

        bringToFront: function () {
            var root = this._map._pathRoot,
                path = this._container;

            if (path && root.lastChild !== path) {
                root.appendChild(path);
            }
            return this;
        },

        bringToBack: function () {
            var root = this._map._pathRoot,
                path = this._container,
                first = root.firstChild;

            if (path && first !== path) {
                root.insertBefore(path, first);
            }
            return this;
        },

        getPathString: function () {
            // form path string here
        },

        _createElement: function (name) {
            return document.createElementNS(L.Path.SVG_NS, name);
        },

        _initElements: function () {
            this._map._initPathRoot();
            this._initPath();
            this._initStyle();
        },

        _initPath: function () {
            this._container = this._createElement('g');

            this._path = this._createElement('path');

            if (this.options.className) {
                L.DomUtil.addClass(this._path, this.options.className);
            }

            this._container.appendChild(this._path);
        },

        _initStyle: function () {
            if (this.options.stroke) {
                this._path.setAttribute('stroke-linejoin', 'round');
                this._path.setAttribute('stroke-linecap', 'round');
            }
            if (this.options.fill) {
                this._path.setAttribute('fill-rule', 'evenodd');
            }
            if (this.options.pointerEvents) {
                this._path.setAttribute('pointer-events', this.options.pointerEvents);
            }
            if (!this.options.clickable && !this.options.pointerEvents) {
                this._path.setAttribute('pointer-events', 'none');
            }
            this._updateStyle();
        },

        _updateStyle: function () {
            if (this.options.stroke) {
                this._path.setAttribute('stroke', this.options.color);
                this._path.setAttribute('stroke-opacity', this.options.opacity);
                this._path.setAttribute('stroke-width', this.options.weight);
                if (this.options.dashArray) {
                    this._path.setAttribute('stroke-dasharray', this.options.dashArray);
                } else {
                    this._path.removeAttribute('stroke-dasharray');
                }
                if (this.options.lineCap) {
                    this._path.setAttribute('stroke-linecap', this.options.lineCap);
                }
                if (this.options.lineJoin) {
                    this._path.setAttribute('stroke-linejoin', this.options.lineJoin);
                }
            } else {
                this._path.setAttribute('stroke', 'none');
            }
            if (this.options.fill) {
                this._path.setAttribute('fill', this.options.fillColor || this.options.color);
                this._path.setAttribute('fill-opacity', this.options.fillOpacity);
            } else {
                this._path.setAttribute('fill', 'none');
            }
        },

        _updatePath: function () {
            var str = this.getPathString();
            if (!str) {
                // fix webkit empty string parsing bug
                str = 'M0 0';
            }
            this._path.setAttribute('d', str);
        },

        // TODO remove duplication with L.Map
        _initEvents: function () {
            if (this.options.clickable) {
                if (L.Browser.svg || !L.Browser.vml) {
                    L.DomUtil.addClass(this._path, 'leaflet-clickable');
                }

                L.DomEvent.on(this._container, 'click', this._onMouseClick, this);

                var events = ['dblclick', 'mousedown', 'mouseover',
                              'mouseout', 'mousemove', 'contextmenu'];
                for (var i = 0; i < events.length; i++) {
                    L.DomEvent.on(this._container, events[i], this._fireMouseEvent, this);
                }
            }
        },

        _onMouseClick: function (e) {
            if (this._map.dragging && this._map.dragging.moved()) { return; }

            this._fireMouseEvent(e);
        },

        _fireMouseEvent: function (e) {
            if (!this.hasEventListeners(e.type)) { return; }

            var map = this._map,
                containerPoint = map.mouseEventToContainerPoint(e),
                layerPoint = map.containerPointToLayerPoint(containerPoint),
                latlng = map.layerPointToLatLng(layerPoint);

            this.fire(e.type, {
                latlng: latlng,
                layerPoint: layerPoint,
                containerPoint: containerPoint,
                originalEvent: e
            });

            if (e.type === 'contextmenu') {
                L.DomEvent.preventDefault(e);
            }
            if (e.type !== 'mousemove') {
                L.DomEvent.stopPropagation(e);
            }
        }
    });

    L.Map.include({
        _initPathRoot: function () {
            if (!this._pathRoot) {
                this._pathRoot = L.Path.prototype._createElement('svg');
                this._panes.overlayPane.appendChild(this._pathRoot);

                if (this.options.zoomAnimation && L.Browser.any3d) {
                    L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

                    this.on({
                        'zoomanim': this._animatePathZoom,
                        'zoomend': this._endPathZoom
                    });
                } else {
                    L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
                }

                this.on('moveend', this._updateSvgViewport);
                this._updateSvgViewport();
            }
        },

        _animatePathZoom: function (e) {
            var scale = this.getZoomScale(e.zoom),
                offset = this._getCenterOffset(e.center)._multiplyBy(-scale)._add(this._pathViewport.min);

            this._pathRoot.style[L.DomUtil.TRANSFORM] =
                    L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

            this._pathZooming = true;
        },

        _endPathZoom: function () {
            this._pathZooming = false;
        },

        _updateSvgViewport: function () {

            if (this._pathZooming) {
                // Do not update SVGs while a zoom animation is going on otherwise the animation will break.
                // When the zoom animation ends we will be updated again anyway
                // This fixes the case where you do a momentum move and zoom while the move is still ongoing.
                return;
            }

            this._updatePathViewport();

            var vp = this._pathViewport,
                min = vp.min,
                max = vp.max,
                width = max.x - min.x,
                height = max.y - min.y,
                root = this._pathRoot,
                pane = this._panes.overlayPane;

            // Hack to make flicker on drag end on mobile webkit less irritating
            if (L.Browser.mobileWebkit) {
                pane.removeChild(root);
            }

            L.DomUtil.setPosition(root, min);
            root.setAttribute('width', width);
            root.setAttribute('height', height);
            root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

            if (L.Browser.mobileWebkit) {
                pane.appendChild(root);
            }
        }
    });


    /*
     * Popup extension to L.Path (polylines, polygons, circles), adding popup-related methods.
     */

    L.Path.include({

        bindPopup: function (content, options) {

            if (content instanceof L.Popup) {
                this._popup = content;
            } else {
                if (!this._popup || options) {
                    this._popup = new L.Popup(options, this);
                }
                this._popup.setContent(content);
            }

            if (!this._popupHandlersAdded) {
                this
                    .on('click', this._openPopup, this)
                    .on('remove', this.closePopup, this);

                this._popupHandlersAdded = true;
            }

            return this;
        },

        unbindPopup: function () {
            if (this._popup) {
                this._popup = null;
                this
                    .off('click', this._openPopup)
                    .off('remove', this.closePopup);

                this._popupHandlersAdded = false;
            }
            return this;
        },

        openPopup: function (latlng) {

            if (this._popup) {
                // open the popup from one of the path's points if not specified
                latlng = latlng || this._latlng ||
                         this._latlngs[Math.floor(this._latlngs.length / 2)];

                this._openPopup({latlng: latlng});
            }

            return this;
        },

        closePopup: function () {
            if (this._popup) {
                this._popup._close();
            }
            return this;
        },

        _openPopup: function (e) {
            this._popup.setLatLng(e.latlng);
            this._map.openPopup(this._popup);
        }
    });


    /*
     * Vector rendering for IE6-8 through VML.
     * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
     */

    L.Browser.vml = !L.Browser.svg && (function () {
        try {
            var div = document.createElement('div');
            div.innerHTML = '<v:shape adj="1"/>';

            var shape = div.firstChild;
            shape.style.behavior = 'url(#default#VML)';

            return shape && (typeof shape.adj === 'object');

        } catch (e) {
            return false;
        }
    }());

    L.Path = L.Browser.svg || !L.Browser.vml ? L.Path : L.Path.extend({
        statics: {
            VML: true,
            CLIP_PADDING: 0.02
        },

        _createElement: (function () {
            try {
                document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
                return function (name) {
                    return document.createElement('<lvml:' + name + ' class="lvml">');
                };
            } catch (e) {
                return function (name) {
                    return document.createElement(
                            '<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
                };
            }
        }()),

        _initPath: function () {
            var container = this._container = this._createElement('shape');

            L.DomUtil.addClass(container, 'leaflet-vml-shape' +
                (this.options.className ? ' ' + this.options.className : ''));

            if (this.options.clickable) {
                L.DomUtil.addClass(container, 'leaflet-clickable');
            }

            container.coordsize = '1 1';

            this._path = this._createElement('path');
            container.appendChild(this._path);

            this._map._pathRoot.appendChild(container);
        },

        _initStyle: function () {
            this._updateStyle();
        },

        _updateStyle: function () {
            var stroke = this._stroke,
                fill = this._fill,
                options = this.options,
                container = this._container;

            container.stroked = options.stroke;
            container.filled = options.fill;

            if (options.stroke) {
                if (!stroke) {
                    stroke = this._stroke = this._createElement('stroke');
                    stroke.endcap = 'round';
                    container.appendChild(stroke);
                }
                stroke.weight = options.weight + 'px';
                stroke.color = options.color;
                stroke.opacity = options.opacity;

                if (options.dashArray) {
                    stroke.dashStyle = L.Util.isArray(options.dashArray) ?
                        options.dashArray.join(' ') :
                        options.dashArray.replace(/( *, *)/g, ' ');
                } else {
                    stroke.dashStyle = '';
                }
                if (options.lineCap) {
                    stroke.endcap = options.lineCap.replace('butt', 'flat');
                }
                if (options.lineJoin) {
                    stroke.joinstyle = options.lineJoin;
                }

            } else if (stroke) {
                container.removeChild(stroke);
                this._stroke = null;
            }

            if (options.fill) {
                if (!fill) {
                    fill = this._fill = this._createElement('fill');
                    container.appendChild(fill);
                }
                fill.color = options.fillColor || options.color;
                fill.opacity = options.fillOpacity;

            } else if (fill) {
                container.removeChild(fill);
                this._fill = null;
            }
        },

        _updatePath: function () {
            var style = this._container.style;

            style.display = 'none';
            this._path.v = this.getPathString() + ' '; // the space fixes IE empty path string bug
            style.display = '';
        }
    });

    L.Map.include(L.Browser.svg || !L.Browser.vml ? {} : {
        _initPathRoot: function () {
            if (this._pathRoot) { return; }

            var root = this._pathRoot = document.createElement('div');
            root.className = 'leaflet-vml-container';
            this._panes.overlayPane.appendChild(root);

            this.on('moveend', this._updatePathViewport);
            this._updatePathViewport();
        }
    });


    /*
     * Vector rendering for all browsers that support canvas.
     */

    L.Browser.canvas = (function () {
        return !!document.createElement('canvas').getContext;
    }());

    L.Path = (L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? L.Path : L.Path.extend({
        statics: {
            //CLIP_PADDING: 0.02, // not sure if there's a need to set it to a small value
            CANVAS: true,
            SVG: false
        },

        redraw: function () {
            if (this._map) {
                this.projectLatlngs();
                this._requestUpdate();
            }
            return this;
        },

        setStyle: function (style) {
            L.setOptions(this, style);

            if (this._map) {
                this._updateStyle();
                this._requestUpdate();
            }
            return this;
        },

        onRemove: function (map) {
            map
                .off('viewreset', this.projectLatlngs, this)
                .off('moveend', this._updatePath, this);

            if (this.options.clickable) {
                this._map.off('click', this._onClick, this);
                this._map.off('mousemove', this._onMouseMove, this);
            }

            this._requestUpdate();

            this._map = null;
        },

        _requestUpdate: function () {
            if (this._map && !L.Path._updateRequest) {
                L.Path._updateRequest = L.Util.requestAnimFrame(this._fireMapMoveEnd, this._map);
            }
        },

        _fireMapMoveEnd: function () {
            L.Path._updateRequest = null;
            this.fire('moveend');
        },

        _initElements: function () {
            this._map._initPathRoot();
            this._ctx = this._map._canvasCtx;
        },

        _updateStyle: function () {
            var options = this.options;

            if (options.stroke) {
                this._ctx.lineWidth = options.weight;
                this._ctx.strokeStyle = options.color;
            }
            if (options.fill) {
                this._ctx.fillStyle = options.fillColor || options.color;
            }
        },

        _drawPath: function () {
            var i, j, len, len2, point, drawMethod;

            this._ctx.beginPath();

            for (i = 0, len = this._parts.length; i < len; i++) {
                for (j = 0, len2 = this._parts[i].length; j < len2; j++) {
                    point = this._parts[i][j];
                    drawMethod = (j === 0 ? 'move' : 'line') + 'To';

                    this._ctx[drawMethod](point.x, point.y);
                }
                // TODO refactor ugly hack
                if (this instanceof L.Polygon) {
                    this._ctx.closePath();
                }
            }
        },

        _checkIfEmpty: function () {
            return !this._parts.length;
        },

        _updatePath: function () {
            if (this._checkIfEmpty()) { return; }

            var ctx = this._ctx,
                options = this.options;

            this._drawPath();
            ctx.save();
            this._updateStyle();

            if (options.fill) {
                ctx.globalAlpha = options.fillOpacity;
                ctx.fill();
            }

            if (options.stroke) {
                ctx.globalAlpha = options.opacity;
                ctx.stroke();
            }

            ctx.restore();

            // TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
        },

        _initEvents: function () {
            if (this.options.clickable) {
                // TODO dblclick
                this._map.on('mousemove', this._onMouseMove, this);
                this._map.on('click', this._onClick, this);
            }
        },

        _onClick: function (e) {
            if (this._containsPoint(e.layerPoint)) {
                this.fire('click', e);
            }
        },

        _onMouseMove: function (e) {
            if (!this._map || this._map._animatingZoom) { return; }

            // TODO don't do on each move
            if (this._containsPoint(e.layerPoint)) {
                this._ctx.canvas.style.cursor = 'pointer';
                this._mouseInside = true;
                this.fire('mouseover', e);

            } else if (this._mouseInside) {
                this._ctx.canvas.style.cursor = '';
                this._mouseInside = false;
                this.fire('mouseout', e);
            }
        }
    });

    L.Map.include((L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? {} : {
        _initPathRoot: function () {
            var root = this._pathRoot,
                ctx;

            if (!root) {
                root = this._pathRoot = document.createElement('canvas');
                root.style.position = 'absolute';
                ctx = this._canvasCtx = root.getContext('2d');

                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                this._panes.overlayPane.appendChild(root);

                if (this.options.zoomAnimation) {
                    this._pathRoot.className = 'leaflet-zoom-animated';
                    this.on('zoomanim', this._animatePathZoom);
                    this.on('zoomend', this._endPathZoom);
                }
                this.on('moveend', this._updateCanvasViewport);
                this._updateCanvasViewport();
            }
        },

        _updateCanvasViewport: function () {
            // don't redraw while zooming. See _updateSvgViewport for more details
            if (this._pathZooming) { return; }
            this._updatePathViewport();

            var vp = this._pathViewport,
                min = vp.min,
                size = vp.max.subtract(min),
                root = this._pathRoot;

            //TODO check if this works properly on mobile webkit
            L.DomUtil.setPosition(root, min);
            root.width = size.x;
            root.height = size.y;
            root.getContext('2d').translate(-min.x, -min.y);
        }
    });


    /*
     * L.LineUtil contains different utility functions for line segments
     * and polylines (clipping, simplification, distances, etc.)
     */

    /*jshint bitwise:false */ // allow bitwise operations for this file

    L.LineUtil = {

        // Simplify polyline with vertex reduction and Douglas-Peucker simplification.
        // Improves rendering performance dramatically by lessening the number of points to draw.

        simplify: function (/*Point[]*/ points, /*Number*/ tolerance) {
            if (!tolerance || !points.length) {
                return points.slice();
            }

            var sqTolerance = tolerance * tolerance;

            // stage 1: vertex reduction
            points = this._reducePoints(points, sqTolerance);

            // stage 2: Douglas-Peucker simplification
            points = this._simplifyDP(points, sqTolerance);

            return points;
        },

        // distance from a point to a segment between two points
        pointToSegmentDistance:  function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
            return Math.sqrt(this._sqClosestPointOnSegment(p, p1, p2, true));
        },

        closestPointOnSegment: function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
            return this._sqClosestPointOnSegment(p, p1, p2);
        },

        // Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
        _simplifyDP: function (points, sqTolerance) {

            var len = points.length,
                ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
                markers = new ArrayConstructor(len);

            markers[0] = markers[len - 1] = 1;

            this._simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

            var i,
                newPoints = [];

            for (i = 0; i < len; i++) {
                if (markers[i]) {
                    newPoints.push(points[i]);
                }
            }

            return newPoints;
        },

        _simplifyDPStep: function (points, markers, sqTolerance, first, last) {

            var maxSqDist = 0,
                index, i, sqDist;

            for (i = first + 1; i <= last - 1; i++) {
                sqDist = this._sqClosestPointOnSegment(points[i], points[first], points[last], true);

                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                markers[index] = 1;

                this._simplifyDPStep(points, markers, sqTolerance, first, index);
                this._simplifyDPStep(points, markers, sqTolerance, index, last);
            }
        },

        // reduce points that are too close to each other to a single point
        _reducePoints: function (points, sqTolerance) {
            var reducedPoints = [points[0]];

            for (var i = 1, prev = 0, len = points.length; i < len; i++) {
                if (this._sqDist(points[i], points[prev]) > sqTolerance) {
                    reducedPoints.push(points[i]);
                    prev = i;
                }
            }
            if (prev < len - 1) {
                reducedPoints.push(points[len - 1]);
            }
            return reducedPoints;
        },

        // Cohen-Sutherland line clipping algorithm.
        // Used to avoid rendering parts of a polyline that are not currently visible.

        clipSegment: function (a, b, bounds, useLastCode) {
            var codeA = useLastCode ? this._lastCode : this._getBitCode(a, bounds),
                codeB = this._getBitCode(b, bounds),

                codeOut, p, newCode;

            // save 2nd code to avoid calculating it on the next segment
            this._lastCode = codeB;

            while (true) {
                // if a,b is inside the clip window (trivial accept)
                if (!(codeA | codeB)) {
                    return [a, b];
                // if a,b is outside the clip window (trivial reject)
                } else if (codeA & codeB) {
                    return false;
                // other cases
                } else {
                    codeOut = codeA || codeB;
                    p = this._getEdgeIntersection(a, b, codeOut, bounds);
                    newCode = this._getBitCode(p, bounds);

                    if (codeOut === codeA) {
                        a = p;
                        codeA = newCode;
                    } else {
                        b = p;
                        codeB = newCode;
                    }
                }
            }
        },

        _getEdgeIntersection: function (a, b, code, bounds) {
            var dx = b.x - a.x,
                dy = b.y - a.y,
                min = bounds.min,
                max = bounds.max;

            if (code & 8) { // top
                return new L.Point(a.x + dx * (max.y - a.y) / dy, max.y);
            } else if (code & 4) { // bottom
                return new L.Point(a.x + dx * (min.y - a.y) / dy, min.y);
            } else if (code & 2) { // right
                return new L.Point(max.x, a.y + dy * (max.x - a.x) / dx);
            } else if (code & 1) { // left
                return new L.Point(min.x, a.y + dy * (min.x - a.x) / dx);
            }
        },

        _getBitCode: function (/*Point*/ p, bounds) {
            var code = 0;

            if (p.x < bounds.min.x) { // left
                code |= 1;
            } else if (p.x > bounds.max.x) { // right
                code |= 2;
            }
            if (p.y < bounds.min.y) { // bottom
                code |= 4;
            } else if (p.y > bounds.max.y) { // top
                code |= 8;
            }

            return code;
        },

        // square distance (to avoid unnecessary Math.sqrt calls)
        _sqDist: function (p1, p2) {
            var dx = p2.x - p1.x,
                dy = p2.y - p1.y;
            return dx * dx + dy * dy;
        },

        // return closest point on segment or distance to that point
        _sqClosestPointOnSegment: function (p, p1, p2, sqDist) {
            var x = p1.x,
                y = p1.y,
                dx = p2.x - x,
                dy = p2.y - y,
                dot = dx * dx + dy * dy,
                t;

            if (dot > 0) {
                t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

                if (t > 1) {
                    x = p2.x;
                    y = p2.y;
                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            dx = p.x - x;
            dy = p.y - y;

            return sqDist ? dx * dx + dy * dy : new L.Point(x, y);
        }
    };


    /*
     * L.Polyline is used to display polylines on a map.
     */

    L.Polyline = L.Path.extend({
        initialize: function (latlngs, options) {
            L.Path.prototype.initialize.call(this, options);

            this._latlngs = this._convertLatLngs(latlngs);
        },

        options: {
            // how much to simplify the polyline on each zoom level
            // more = better performance and smoother look, less = more accurate
            smoothFactor: 1.0,
            noClip: false
        },

        projectLatlngs: function () {
            this._originalPoints = [];

            for (var i = 0, len = this._latlngs.length; i < len; i++) {
                this._originalPoints[i] = this._map.latLngToLayerPoint(this._latlngs[i]);
            }
        },

        getPathString: function () {
            for (var i = 0, len = this._parts.length, str = ''; i < len; i++) {
                str += this._getPathPartStr(this._parts[i]);
            }
            return str;
        },

        getLatLngs: function () {
            return this._latlngs;
        },

        setLatLngs: function (latlngs) {
            this._latlngs = this._convertLatLngs(latlngs);
            return this.redraw();
        },

        addLatLng: function (latlng) {
            this._latlngs.push(L.latLng(latlng));
            return this.redraw();
        },

        spliceLatLngs: function () { // (Number index, Number howMany)
            var removed = [].splice.apply(this._latlngs, arguments);
            this._convertLatLngs(this._latlngs, true);
            this.redraw();
            return removed;
        },

        closestLayerPoint: function (p) {
            var minDistance = Infinity, parts = this._parts, p1, p2, minPoint = null;

            for (var j = 0, jLen = parts.length; j < jLen; j++) {
                var points = parts[j];
                for (var i = 1, len = points.length; i < len; i++) {
                    p1 = points[i - 1];
                    p2 = points[i];
                    var sqDist = L.LineUtil._sqClosestPointOnSegment(p, p1, p2, true);
                    if (sqDist < minDistance) {
                        minDistance = sqDist;
                        minPoint = L.LineUtil._sqClosestPointOnSegment(p, p1, p2);
                    }
                }
            }
            if (minPoint) {
                minPoint.distance = Math.sqrt(minDistance);
            }
            return minPoint;
        },

        getBounds: function () {
            return new L.LatLngBounds(this.getLatLngs());
        },

        _convertLatLngs: function (latlngs, overwrite) {
            var i, len, target = overwrite ? latlngs : [];

            for (i = 0, len = latlngs.length; i < len; i++) {
                if (L.Util.isArray(latlngs[i]) && typeof latlngs[i][0] !== 'number') {
                    return;
                }
                target[i] = L.latLng(latlngs[i]);
            }
            return target;
        },

        _initEvents: function () {
            L.Path.prototype._initEvents.call(this);
        },

        _getPathPartStr: function (points) {
            var round = L.Path.VML;

            for (var j = 0, len2 = points.length, str = '', p; j < len2; j++) {
                p = points[j];
                if (round) {
                    p._round();
                }
                str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
            }
            return str;
        },

        _clipPoints: function () {
            var points = this._originalPoints,
                len = points.length,
                i, k, segment;

            if (this.options.noClip) {
                this._parts = [points];
                return;
            }

            this._parts = [];

            var parts = this._parts,
                vp = this._map._pathViewport,
                lu = L.LineUtil;

            for (i = 0, k = 0; i < len - 1; i++) {
                segment = lu.clipSegment(points[i], points[i + 1], vp, i);
                if (!segment) {
                    continue;
                }

                parts[k] = parts[k] || [];
                parts[k].push(segment[0]);

                // if segment goes out of screen, or it's the last one, it's the end of the line part
                if ((segment[1] !== points[i + 1]) || (i === len - 2)) {
                    parts[k].push(segment[1]);
                    k++;
                }
            }
        },

        // simplify each clipped part of the polyline
        _simplifyPoints: function () {
            var parts = this._parts,
                lu = L.LineUtil;

            for (var i = 0, len = parts.length; i < len; i++) {
                parts[i] = lu.simplify(parts[i], this.options.smoothFactor);
            }
        },

        _updatePath: function () {
            if (!this._map) { return; }

            this._clipPoints();
            this._simplifyPoints();

            L.Path.prototype._updatePath.call(this);
        }
    });

    L.polyline = function (latlngs, options) {
        return new L.Polyline(latlngs, options);
    };


    /*
     * L.PolyUtil contains utility functions for polygons (clipping, etc.).
     */

    /*jshint bitwise:false */ // allow bitwise operations here

    L.PolyUtil = {};

    /*
     * Sutherland-Hodgeman polygon clipping algorithm.
     * Used to avoid rendering parts of a polygon that are not currently visible.
     */
    L.PolyUtil.clipPolygon = function (points, bounds) {
        var clippedPoints,
            edges = [1, 4, 2, 8],
            i, j, k,
            a, b,
            len, edge, p,
            lu = L.LineUtil;

        for (i = 0, len = points.length; i < len; i++) {
            points[i]._code = lu._getBitCode(points[i], bounds);
        }

        // for each edge (left, bottom, right, top)
        for (k = 0; k < 4; k++) {
            edge = edges[k];
            clippedPoints = [];

            for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
                a = points[i];
                b = points[j];

                // if a is inside the clip window
                if (!(a._code & edge)) {
                    // if b is outside the clip window (a->b goes out of screen)
                    if (b._code & edge) {
                        p = lu._getEdgeIntersection(b, a, edge, bounds);
                        p._code = lu._getBitCode(p, bounds);
                        clippedPoints.push(p);
                    }
                    clippedPoints.push(a);

                // else if b is inside the clip window (a->b enters the screen)
                } else if (!(b._code & edge)) {
                    p = lu._getEdgeIntersection(b, a, edge, bounds);
                    p._code = lu._getBitCode(p, bounds);
                    clippedPoints.push(p);
                }
            }
            points = clippedPoints;
        }

        return points;
    };


    /*
     * L.Polygon is used to display polygons on a map.
     */

    L.Polygon = L.Polyline.extend({
        options: {
            fill: true
        },

        initialize: function (latlngs, options) {
            L.Polyline.prototype.initialize.call(this, latlngs, options);
            this._initWithHoles(latlngs);
        },

        _initWithHoles: function (latlngs) {
            var i, len, hole;
            if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
                this._latlngs = this._convertLatLngs(latlngs[0]);
                this._holes = latlngs.slice(1);

                for (i = 0, len = this._holes.length; i < len; i++) {
                    hole = this._holes[i] = this._convertLatLngs(this._holes[i]);
                    if (hole[0].equals(hole[hole.length - 1])) {
                        hole.pop();
                    }
                }
            }

            // filter out last point if its equal to the first one
            latlngs = this._latlngs;

            if (latlngs.length >= 2 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
                latlngs.pop();
            }
        },

        projectLatlngs: function () {
            L.Polyline.prototype.projectLatlngs.call(this);

            // project polygon holes points
            // TODO move this logic to Polyline to get rid of duplication
            this._holePoints = [];

            if (!this._holes) { return; }

            var i, j, len, len2;

            for (i = 0, len = this._holes.length; i < len; i++) {
                this._holePoints[i] = [];

                for (j = 0, len2 = this._holes[i].length; j < len2; j++) {
                    this._holePoints[i][j] = this._map.latLngToLayerPoint(this._holes[i][j]);
                }
            }
        },

        setLatLngs: function (latlngs) {
            if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
                this._initWithHoles(latlngs);
                return this.redraw();
            } else {
                return L.Polyline.prototype.setLatLngs.call(this, latlngs);
            }
        },

        _clipPoints: function () {
            var points = this._originalPoints,
                newParts = [];

            this._parts = [points].concat(this._holePoints);

            if (this.options.noClip) { return; }

            for (var i = 0, len = this._parts.length; i < len; i++) {
                var clipped = L.PolyUtil.clipPolygon(this._parts[i], this._map._pathViewport);
                if (clipped.length) {
                    newParts.push(clipped);
                }
            }

            this._parts = newParts;
        },

        _getPathPartStr: function (points) {
            var str = L.Polyline.prototype._getPathPartStr.call(this, points);
            return str + (L.Browser.svg ? 'z' : 'x');
        }
    });

    L.polygon = function (latlngs, options) {
        return new L.Polygon(latlngs, options);
    };


    /*
     * Contains L.MultiPolyline and L.MultiPolygon layers.
     */

    (function () {
        function createMulti(Klass) {

            return L.FeatureGroup.extend({

                initialize: function (latlngs, options) {
                    this._layers = {};
                    this._options = options;
                    this.setLatLngs(latlngs);
                },

                setLatLngs: function (latlngs) {
                    var i = 0,
                        len = latlngs.length;

                    this.eachLayer(function (layer) {
                        if (i < len) {
                            layer.setLatLngs(latlngs[i++]);
                        } else {
                            this.removeLayer(layer);
                        }
                    }, this);

                    while (i < len) {
                        this.addLayer(new Klass(latlngs[i++], this._options));
                    }

                    return this;
                },

                getLatLngs: function () {
                    var latlngs = [];

                    this.eachLayer(function (layer) {
                        latlngs.push(layer.getLatLngs());
                    });

                    return latlngs;
                }
            });
        }

        L.MultiPolyline = createMulti(L.Polyline);
        L.MultiPolygon = createMulti(L.Polygon);

        L.multiPolyline = function (latlngs, options) {
            return new L.MultiPolyline(latlngs, options);
        };

        L.multiPolygon = function (latlngs, options) {
            return new L.MultiPolygon(latlngs, options);
        };
    }());


    /*
     * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
     */

    L.Rectangle = L.Polygon.extend({
        initialize: function (latLngBounds, options) {
            L.Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
        },

        setBounds: function (latLngBounds) {
            this.setLatLngs(this._boundsToLatLngs(latLngBounds));
        },

        _boundsToLatLngs: function (latLngBounds) {
            latLngBounds = L.latLngBounds(latLngBounds);
            return [
                latLngBounds.getSouthWest(),
                latLngBounds.getNorthWest(),
                latLngBounds.getNorthEast(),
                latLngBounds.getSouthEast()
            ];
        }
    });

    L.rectangle = function (latLngBounds, options) {
        return new L.Rectangle(latLngBounds, options);
    };


    /*
     * L.Circle is a circle overlay (with a certain radius in meters).
     */

    L.Circle = L.Path.extend({
        initialize: function (latlng, radius, options) {
            L.Path.prototype.initialize.call(this, options);

            this._latlng = L.latLng(latlng);
            this._mRadius = radius;
        },

        options: {
            fill: true
        },

        setLatLng: function (latlng) {
            this._latlng = L.latLng(latlng);
            return this.redraw();
        },

        setRadius: function (radius) {
            this._mRadius = radius;
            return this.redraw();
        },

        projectLatlngs: function () {
            var lngRadius = this._getLngRadius(),
                latlng = this._latlng,
                pointLeft = this._map.latLngToLayerPoint([latlng.lat, latlng.lng - lngRadius]);

            this._point = this._map.latLngToLayerPoint(latlng);
            this._radius = Math.max(this._point.x - pointLeft.x, 1);
        },

        getBounds: function () {
            var lngRadius = this._getLngRadius(),
                latRadius = (this._mRadius / 40075017) * 360,
                latlng = this._latlng;

            return new L.LatLngBounds(
                    [latlng.lat - latRadius, latlng.lng - lngRadius],
                    [latlng.lat + latRadius, latlng.lng + lngRadius]);
        },

        getLatLng: function () {
            return this._latlng;
        },

        getPathString: function () {
            var p = this._point,
                r = this._radius;

            if (this._checkIfEmpty()) {
                return '';
            }

            if (L.Browser.svg) {
                return 'M' + p.x + ',' + (p.y - r) +
                       'A' + r + ',' + r + ',0,1,1,' +
                       (p.x - 0.1) + ',' + (p.y - r) + ' z';
            } else {
                p._round();
                r = Math.round(r);
                return 'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r + ' 0,' + (65535 * 360);
            }
        },

        getRadius: function () {
            return this._mRadius;
        },

        // TODO Earth hardcoded, move into projection code!

        _getLatRadius: function () {
            return (this._mRadius / 40075017) * 360;
        },

        _getLngRadius: function () {
            return this._getLatRadius() / Math.cos(L.LatLng.DEG_TO_RAD * this._latlng.lat);
        },

        _checkIfEmpty: function () {
            if (!this._map) {
                return false;
            }
            var vp = this._map._pathViewport,
                r = this._radius,
                p = this._point;

            return p.x - r > vp.max.x || p.y - r > vp.max.y ||
                   p.x + r < vp.min.x || p.y + r < vp.min.y;
        }
    });

    L.circle = function (latlng, radius, options) {
        return new L.Circle(latlng, radius, options);
    };


    /*
     * L.CircleMarker is a circle overlay with a permanent pixel radius.
     */

    L.CircleMarker = L.Circle.extend({
        options: {
            radius: 10,
            weight: 2
        },

        initialize: function (latlng, options) {
            L.Circle.prototype.initialize.call(this, latlng, null, options);
            this._radius = this.options.radius;
        },

        projectLatlngs: function () {
            this._point = this._map.latLngToLayerPoint(this._latlng);
        },

        _updateStyle : function () {
            L.Circle.prototype._updateStyle.call(this);
            this.setRadius(this.options.radius);
        },

        setLatLng: function (latlng) {
            L.Circle.prototype.setLatLng.call(this, latlng);
            if (this._popup && this._popup._isOpen) {
                this._popup.setLatLng(latlng);
            }
            return this;
        },

        setRadius: function (radius) {
            this.options.radius = this._radius = radius;
            return this.redraw();
        },

        getRadius: function () {
            return this._radius;
        }
    });

    L.circleMarker = function (latlng, options) {
        return new L.CircleMarker(latlng, options);
    };


    /*
     * Extends L.Polyline to be able to manually detect clicks on Canvas-rendered polylines.
     */

    L.Polyline.include(!L.Path.CANVAS ? {} : {
        _containsPoint: function (p, closed) {
            var i, j, k, len, len2, dist, part,
                w = this.options.weight / 2;

            if (L.Browser.touch) {
                w += 10; // polyline click tolerance on touch devices
            }

            for (i = 0, len = this._parts.length; i < len; i++) {
                part = this._parts[i];
                for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                    if (!closed && (j === 0)) {
                        continue;
                    }

                    dist = L.LineUtil.pointToSegmentDistance(p, part[k], part[j]);

                    if (dist <= w) {
                        return true;
                    }
                }
            }
            return false;
        }
    });


    /*
     * Extends L.Polygon to be able to manually detect clicks on Canvas-rendered polygons.
     */

    L.Polygon.include(!L.Path.CANVAS ? {} : {
        _containsPoint: function (p) {
            var inside = false,
                part, p1, p2,
                i, j, k,
                len, len2;

            // TODO optimization: check if within bounds first

            if (L.Polyline.prototype._containsPoint.call(this, p, true)) {
                // click on polygon border
                return true;
            }

            // ray casting algorithm for detecting if point is in polygon

            for (i = 0, len = this._parts.length; i < len; i++) {
                part = this._parts[i];

                for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                    p1 = part[j];
                    p2 = part[k];

                    if (((p1.y > p.y) !== (p2.y > p.y)) &&
                            (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                        inside = !inside;
                    }
                }
            }

            return inside;
        }
    });


    /*
     * Extends L.Circle with Canvas-specific code.
     */

    L.Circle.include(!L.Path.CANVAS ? {} : {
        _drawPath: function () {
            var p = this._point;
            this._ctx.beginPath();
            this._ctx.arc(p.x, p.y, this._radius, 0, Math.PI * 2, false);
        },

        _containsPoint: function (p) {
            var center = this._point,
                w2 = this.options.stroke ? this.options.weight / 2 : 0;

            return (p.distanceTo(center) <= this._radius + w2);
        }
    });


    /*
     * CircleMarker canvas specific drawing parts.
     */

    L.CircleMarker.include(!L.Path.CANVAS ? {} : {
        _updateStyle: function () {
            L.Path.prototype._updateStyle.call(this);
        }
    });


    /*
     * L.GeoJSON turns any GeoJSON data into a Leaflet layer.
     */

    L.GeoJSON = L.FeatureGroup.extend({

        initialize: function (geojson, options) {
            L.setOptions(this, options);

            this._layers = {};

            if (geojson) {
                this.addData(geojson);
            }
        },

        addData: function (geojson) {
            var features = L.Util.isArray(geojson) ? geojson : geojson.features,
                i, len, feature;

            if (features) {
                for (i = 0, len = features.length; i < len; i++) {
                    // Only add this if geometry or geometries are set and not null
                    feature = features[i];
                    if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
                        this.addData(features[i]);
                    }
                }
                return this;
            }

            var options = this.options;

            if (options.filter && !options.filter(geojson)) { return; }

            var layer = L.GeoJSON.geometryToLayer(geojson, options.pointToLayer, options.coordsToLatLng, options);
            layer.feature = L.GeoJSON.asFeature(geojson);

            layer.defaultOptions = layer.options;
            this.resetStyle(layer);

            if (options.onEachFeature) {
                options.onEachFeature(geojson, layer);
            }

            return this.addLayer(layer);
        },

        resetStyle: function (layer) {
            var style = this.options.style;
            if (style) {
                // reset any custom styles
                L.Util.extend(layer.options, layer.defaultOptions);

                this._setLayerStyle(layer, style);
            }
        },

        setStyle: function (style) {
            this.eachLayer(function (layer) {
                this._setLayerStyle(layer, style);
            }, this);
        },

        _setLayerStyle: function (layer, style) {
            if (typeof style === 'function') {
                style = style(layer.feature);
            }
            if (layer.setStyle) {
                layer.setStyle(style);
            }
        }
    });

    L.extend(L.GeoJSON, {
        geometryToLayer: function (geojson, pointToLayer, coordsToLatLng, vectorOptions) {
            var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
                coords = geometry.coordinates,
                layers = [],
                latlng, latlngs, i, len;

            coordsToLatLng = coordsToLatLng || this.coordsToLatLng;

            switch (geometry.type) {
            case 'Point':
                latlng = coordsToLatLng(coords);
                return pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng);

            case 'MultiPoint':
                for (i = 0, len = coords.length; i < len; i++) {
                    latlng = coordsToLatLng(coords[i]);
                    layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng));
                }
                return new L.FeatureGroup(layers);

            case 'LineString':
                latlngs = this.coordsToLatLngs(coords, 0, coordsToLatLng);
                return new L.Polyline(latlngs, vectorOptions);

            case 'Polygon':
                if (coords.length === 2 && !coords[1].length) {
                    throw new Error('Invalid GeoJSON object.');
                }
                latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
                return new L.Polygon(latlngs, vectorOptions);

            case 'MultiLineString':
                latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
                return new L.MultiPolyline(latlngs, vectorOptions);

            case 'MultiPolygon':
                latlngs = this.coordsToLatLngs(coords, 2, coordsToLatLng);
                return new L.MultiPolygon(latlngs, vectorOptions);

            case 'GeometryCollection':
                for (i = 0, len = geometry.geometries.length; i < len; i++) {

                    layers.push(this.geometryToLayer({
                        geometry: geometry.geometries[i],
                        type: 'Feature',
                        properties: geojson.properties
                    }, pointToLayer, coordsToLatLng, vectorOptions));
                }
                return new L.FeatureGroup(layers);

            default:
                throw new Error('Invalid GeoJSON object.');
            }
        },

        coordsToLatLng: function (coords) { // (Array[, Boolean]) -> LatLng
            return new L.LatLng(coords[1], coords[0], coords[2]);
        },

        coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) { // (Array[, Number, Function]) -> Array
            var latlng, i, len,
                latlngs = [];

            for (i = 0, len = coords.length; i < len; i++) {
                latlng = levelsDeep ?
                        this.coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
                        (coordsToLatLng || this.coordsToLatLng)(coords[i]);

                latlngs.push(latlng);
            }

            return latlngs;
        },

        latLngToCoords: function (latlng) {
            var coords = [latlng.lng, latlng.lat];

            if (latlng.alt !== undefined) {
                coords.push(latlng.alt);
            }
            return coords;
        },

        latLngsToCoords: function (latLngs) {
            var coords = [];

            for (var i = 0, len = latLngs.length; i < len; i++) {
                coords.push(L.GeoJSON.latLngToCoords(latLngs[i]));
            }

            return coords;
        },

        getFeature: function (layer, newGeometry) {
            return layer.feature ? L.extend({}, layer.feature, {geometry: newGeometry}) : L.GeoJSON.asFeature(newGeometry);
        },

        asFeature: function (geoJSON) {
            if (geoJSON.type === 'Feature') {
                return geoJSON;
            }

            return {
                type: 'Feature',
                properties: {},
                geometry: geoJSON
            };
        }
    });

    var PointToGeoJSON = {
        toGeoJSON: function () {
            return L.GeoJSON.getFeature(this, {
                type: 'Point',
                coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
            });
        }
    };

    L.Marker.include(PointToGeoJSON);
    L.Circle.include(PointToGeoJSON);
    L.CircleMarker.include(PointToGeoJSON);

    L.Polyline.include({
        toGeoJSON: function () {
            return L.GeoJSON.getFeature(this, {
                type: 'LineString',
                coordinates: L.GeoJSON.latLngsToCoords(this.getLatLngs())
            });
        }
    });

    L.Polygon.include({
        toGeoJSON: function () {
            var coords = [L.GeoJSON.latLngsToCoords(this.getLatLngs())],
                i, len, hole;

            coords[0].push(coords[0][0]);

            if (this._holes) {
                for (i = 0, len = this._holes.length; i < len; i++) {
                    hole = L.GeoJSON.latLngsToCoords(this._holes[i]);
                    hole.push(hole[0]);
                    coords.push(hole);
                }
            }

            return L.GeoJSON.getFeature(this, {
                type: 'Polygon',
                coordinates: coords
            });
        }
    });

    (function () {
        function multiToGeoJSON(type) {
            return function () {
                var coords = [];

                this.eachLayer(function (layer) {
                    coords.push(layer.toGeoJSON().geometry.coordinates);
                });

                return L.GeoJSON.getFeature(this, {
                    type: type,
                    coordinates: coords
                });
            };
        }

        L.MultiPolyline.include({toGeoJSON: multiToGeoJSON('MultiLineString')});
        L.MultiPolygon.include({toGeoJSON: multiToGeoJSON('MultiPolygon')});

        L.LayerGroup.include({
            toGeoJSON: function () {

                var geometry = this.feature && this.feature.geometry,
                    jsons = [],
                    json;

                if (geometry && geometry.type === 'MultiPoint') {
                    return multiToGeoJSON('MultiPoint').call(this);
                }

                var isGeometryCollection = geometry && geometry.type === 'GeometryCollection';

                this.eachLayer(function (layer) {
                    if (layer.toGeoJSON) {
                        json = layer.toGeoJSON();
                        jsons.push(isGeometryCollection ? json.geometry : L.GeoJSON.asFeature(json));
                    }
                });

                if (isGeometryCollection) {
                    return L.GeoJSON.getFeature(this, {
                        geometries: jsons,
                        type: 'GeometryCollection'
                    });
                }

                return {
                    type: 'FeatureCollection',
                    features: jsons
                };
            }
        });
    }());

    L.geoJson = function (geojson, options) {
        return new L.GeoJSON(geojson, options);
    };


    /*
     * L.DomEvent contains functions for working with DOM events.
     */

    L.DomEvent = {
        /* inspired by John Resig, Dean Edwards and YUI addEvent implementations */
        addListener: function (obj, type, fn, context) { // (HTMLElement, String, Function[, Object])

            var id = L.stamp(fn),
                key = '_leaflet_' + type + id,
                handler, originalHandler, newType;

            if (obj[key]) { return this; }

            handler = function (e) {
                return fn.call(context || obj, e || L.DomEvent._getEvent());
            };

            if (L.Browser.pointer && type.indexOf('touch') === 0) {
                return this.addPointerListener(obj, type, handler, id);
            }
            if (L.Browser.touch && (type === 'dblclick') && this.addDoubleTapListener) {
                this.addDoubleTapListener(obj, handler, id);
            }

            if ('addEventListener' in obj) {

                if (type === 'mousewheel') {
                    obj.addEventListener('DOMMouseScroll', handler, false);
                    obj.addEventListener(type, handler, false);

                } else if ((type === 'mouseenter') || (type === 'mouseleave')) {

                    originalHandler = handler;
                    newType = (type === 'mouseenter' ? 'mouseover' : 'mouseout');

                    handler = function (e) {
                        if (!L.DomEvent._checkMouse(obj, e)) { return; }
                        return originalHandler(e);
                    };

                    obj.addEventListener(newType, handler, false);

                } else if (type === 'click' && L.Browser.android) {
                    originalHandler = handler;
                    handler = function (e) {
                        return L.DomEvent._filterClick(e, originalHandler);
                    };

                    obj.addEventListener(type, handler, false);
                } else {
                    obj.addEventListener(type, handler, false);
                }

            } else if ('attachEvent' in obj) {
                obj.attachEvent('on' + type, handler);
            }

            obj[key] = handler;

            return this;
        },

        removeListener: function (obj, type, fn) {  // (HTMLElement, String, Function)

            var id = L.stamp(fn),
                key = '_leaflet_' + type + id,
                handler = obj[key];

            if (!handler) { return this; }

            if (L.Browser.pointer && type.indexOf('touch') === 0) {
                this.removePointerListener(obj, type, id);
            } else if (L.Browser.touch && (type === 'dblclick') && this.removeDoubleTapListener) {
                this.removeDoubleTapListener(obj, id);

            } else if ('removeEventListener' in obj) {

                if (type === 'mousewheel') {
                    obj.removeEventListener('DOMMouseScroll', handler, false);
                    obj.removeEventListener(type, handler, false);

                } else if ((type === 'mouseenter') || (type === 'mouseleave')) {
                    obj.removeEventListener((type === 'mouseenter' ? 'mouseover' : 'mouseout'), handler, false);
                } else {
                    obj.removeEventListener(type, handler, false);
                }
            } else if ('detachEvent' in obj) {
                obj.detachEvent('on' + type, handler);
            }

            obj[key] = null;

            return this;
        },

        stopPropagation: function (e) {

            if (e.stopPropagation) {
                e.stopPropagation();
            } else {
                e.cancelBubble = true;
            }
            L.DomEvent._skipped(e);

            return this;
        },

        disableScrollPropagation: function (el) {
            var stop = L.DomEvent.stopPropagation;

            return L.DomEvent
                .on(el, 'mousewheel', stop)
                .on(el, 'MozMousePixelScroll', stop);
        },

        disableClickPropagation: function (el) {
            var stop = L.DomEvent.stopPropagation;

            for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
                L.DomEvent.on(el, L.Draggable.START[i], stop);
            }

            return L.DomEvent
                .on(el, 'click', L.DomEvent._fakeStop)
                .on(el, 'dblclick', stop);
        },

        preventDefault: function (e) {

            if (e.preventDefault) {
                e.preventDefault();
            } else {
                e.returnValue = false;
            }
            return this;
        },

        stop: function (e) {
            return L.DomEvent
                .preventDefault(e)
                .stopPropagation(e);
        },

        getMousePosition: function (e, container) {
            if (!container) {
                return new L.Point(e.clientX, e.clientY);
            }

            var rect = container.getBoundingClientRect();

            return new L.Point(
                e.clientX - rect.left - container.clientLeft,
                e.clientY - rect.top - container.clientTop);
        },

        getWheelDelta: function (e) {

            var delta = 0;

            if (e.wheelDelta) {
                delta = e.wheelDelta / 120;
            }
            if (e.detail) {
                delta = -e.detail / 3;
            }
            return delta;
        },

        _skipEvents: {},

        _fakeStop: function (e) {
            // fakes stopPropagation by setting a special event flag, checked/reset with L.DomEvent._skipped(e)
            L.DomEvent._skipEvents[e.type] = true;
        },

        _skipped: function (e) {
            var skipped = this._skipEvents[e.type];
            // reset when checking, as it's only used in map container and propagates outside of the map
            this._skipEvents[e.type] = false;
            return skipped;
        },

        // check if element really left/entered the event target (for mouseenter/mouseleave)
        _checkMouse: function (el, e) {

            var related = e.relatedTarget;

            if (!related) { return true; }

            try {
                while (related && (related !== el)) {
                    related = related.parentNode;
                }
            } catch (err) {
                return false;
            }
            return (related !== el);
        },

        _getEvent: function () { // evil magic for IE
            /*jshint noarg:false */
            var e = window.event;
            if (!e) {
                var caller = arguments.callee.caller;
                while (caller) {
                    e = caller['arguments'][0];
                    if (e && window.Event === e.constructor) {
                        break;
                    }
                    caller = caller.caller;
                }
            }
            return e;
        },

        // this is a horrible workaround for a bug in Android where a single touch triggers two click events
        _filterClick: function (e, handler) {
            var timeStamp = (e.timeStamp || e.originalEvent.timeStamp),
                elapsed = L.DomEvent._lastClick && (timeStamp - L.DomEvent._lastClick);

            // are they closer together than 1000ms yet more than 100ms?
            // Android typically triggers them ~300ms apart while multiple listeners
            // on the same event should be triggered far faster;
            // or check if click is simulated on the element, and if it is, reject any non-simulated events

            if ((elapsed && elapsed > 100 && elapsed < 1000) || (e.target._simulatedClick && !e._simulated)) {
                L.DomEvent.stop(e);
                return;
            }
            L.DomEvent._lastClick = timeStamp;

            return handler(e);
        }
    };

    L.DomEvent.on = L.DomEvent.addListener;
    L.DomEvent.off = L.DomEvent.removeListener;


    /*
     * L.Draggable allows you to add dragging capabilities to any element. Supports mobile devices too.
     */

    L.Draggable = L.Class.extend({
        includes: L.Mixin.Events,

        statics: {
            START: L.Browser.touch ? ['touchstart', 'mousedown'] : ['mousedown'],
            END: {
                mousedown: 'mouseup',
                touchstart: 'touchend',
                pointerdown: 'touchend',
                MSPointerDown: 'touchend'
            },
            MOVE: {
                mousedown: 'mousemove',
                touchstart: 'touchmove',
                pointerdown: 'touchmove',
                MSPointerDown: 'touchmove'
            }
        },

        initialize: function (element, dragStartTarget) {
            this._element = element;
            this._dragStartTarget = dragStartTarget || element;
        },

        enable: function () {
            if (this._enabled) { return; }

            for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
                L.DomEvent.on(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
            }

            this._enabled = true;
        },

        disable: function () {
            if (!this._enabled) { return; }

            for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
                L.DomEvent.off(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
            }

            this._enabled = false;
            this._moved = false;
        },

        _onDown: function (e) {
            this._moved = false;

            if (e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }

            L.DomEvent.stopPropagation(e);

            if (L.Draggable._disabled) { return; }

            L.DomUtil.disableImageDrag();
            L.DomUtil.disableTextSelection();

            if (this._moving) { return; }

            var first = e.touches ? e.touches[0] : e;

            this._startPoint = new L.Point(first.clientX, first.clientY);
            this._startPos = this._newPos = L.DomUtil.getPosition(this._element);

            L.DomEvent
                .on(document, L.Draggable.MOVE[e.type], this._onMove, this)
                .on(document, L.Draggable.END[e.type], this._onUp, this);
        },

        _onMove: function (e) {
            if (e.touches && e.touches.length > 1) {
                this._moved = true;
                return;
            }

            var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
                newPoint = new L.Point(first.clientX, first.clientY),
                offset = newPoint.subtract(this._startPoint);

            if (!offset.x && !offset.y) { return; }

            L.DomEvent.preventDefault(e);

            if (!this._moved) {
                this.fire('dragstart');

                this._moved = true;
                this._startPos = L.DomUtil.getPosition(this._element).subtract(offset);

                L.DomUtil.addClass(document.body, 'leaflet-dragging');
                L.DomUtil.addClass((e.target || e.srcElement), 'leaflet-drag-target');
            }

            this._newPos = this._startPos.add(offset);
            this._moving = true;

            L.Util.cancelAnimFrame(this._animRequest);
            this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true, this._dragStartTarget);
        },

        _updatePosition: function () {
            this.fire('predrag');
            L.DomUtil.setPosition(this._element, this._newPos);
            this.fire('drag');
        },

        _onUp: function (e) {
            L.DomUtil.removeClass(document.body, 'leaflet-dragging');
            L.DomUtil.removeClass((e.target || e.srcElement), 'leaflet-drag-target');

            for (var i in L.Draggable.MOVE) {
                L.DomEvent
                    .off(document, L.Draggable.MOVE[i], this._onMove)
                    .off(document, L.Draggable.END[i], this._onUp);
            }

            L.DomUtil.enableImageDrag();
            L.DomUtil.enableTextSelection();

            if (this._moved && this._moving) {
                // ensure drag is not fired after dragend
                L.Util.cancelAnimFrame(this._animRequest);

                this.fire('dragend', {
                    distance: this._newPos.distanceTo(this._startPos)
                });
            }

            this._moving = false;
        }
    });


    /*
        L.Handler is a base class for handler classes that are used internally to inject
        interaction features like dragging to classes like Map and Marker.
    */

    L.Handler = L.Class.extend({
        initialize: function (map) {
            this._map = map;
        },

        enable: function () {
            if (this._enabled) { return; }

            this._enabled = true;
            this.addHooks();
        },

        disable: function () {
            if (!this._enabled) { return; }

            this._enabled = false;
            this.removeHooks();
        },

        enabled: function () {
            return !!this._enabled;
        }
    });


    /*
     * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
     */

    L.Map.mergeOptions({
        dragging: true,

        inertia: !L.Browser.android23,
        inertiaDeceleration: 3400, // px/s^2
        inertiaMaxSpeed: Infinity, // px/s
        inertiaThreshold: L.Browser.touch ? 32 : 18, // ms
        easeLinearity: 0.25,

        // TODO refactor, move to CRS
        worldCopyJump: false
    });

    L.Map.Drag = L.Handler.extend({
        addHooks: function () {
            if (!this._draggable) {
                var map = this._map;

                this._draggable = new L.Draggable(map._mapPane, map._container);

                this._draggable.on({
                    'dragstart': this._onDragStart,
                    'drag': this._onDrag,
                    'dragend': this._onDragEnd
                }, this);

                if (map.options.worldCopyJump) {
                    this._draggable.on('predrag', this._onPreDrag, this);
                    map.on('viewreset', this._onViewReset, this);

                    map.whenReady(this._onViewReset, this);
                }
            }
            this._draggable.enable();
        },

        removeHooks: function () {
            this._draggable.disable();
        },

        moved: function () {
            return this._draggable && this._draggable._moved;
        },

        _onDragStart: function () {
            var map = this._map;

            if (map._panAnim) {
                map._panAnim.stop();
            }

            map
                .fire('movestart')
                .fire('dragstart');

            if (map.options.inertia) {
                this._positions = [];
                this._times = [];
            }
        },

        _onDrag: function () {
            if (this._map.options.inertia) {
                var time = this._lastTime = +new Date(),
                    pos = this._lastPos = this._draggable._newPos;

                this._positions.push(pos);
                this._times.push(time);

                if (time - this._times[0] > 200) {
                    this._positions.shift();
                    this._times.shift();
                }
            }

            this._map
                .fire('move')
                .fire('drag');
        },

        _onViewReset: function () {
            // TODO fix hardcoded Earth values
            var pxCenter = this._map.getSize()._divideBy(2),
                pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

            this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
            this._worldWidth = this._map.project([0, 180]).x;
        },

        _onPreDrag: function () {
            // TODO refactor to be able to adjust map pane position after zoom
            var worldWidth = this._worldWidth,
                halfWidth = Math.round(worldWidth / 2),
                dx = this._initialWorldOffset,
                x = this._draggable._newPos.x,
                newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
                newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
                newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

            this._draggable._newPos.x = newX;
        },

        _onDragEnd: function (e) {
            var map = this._map,
                options = map.options,
                delay = +new Date() - this._lastTime,

                noInertia = !options.inertia || delay > options.inertiaThreshold || !this._positions[0];

            map.fire('dragend', e);

            if (noInertia) {
                map.fire('moveend');

            } else {

                var direction = this._lastPos.subtract(this._positions[0]),
                    duration = (this._lastTime + delay - this._times[0]) / 1000,
                    ease = options.easeLinearity,

                    speedVector = direction.multiplyBy(ease / duration),
                    speed = speedVector.distanceTo([0, 0]),

                    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
                    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

                    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
                    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

                if (!offset.x || !offset.y) {
                    map.fire('moveend');

                } else {
                    offset = map._limitOffset(offset, map.options.maxBounds);

                    L.Util.requestAnimFrame(function () {
                        map.panBy(offset, {
                            duration: decelerationDuration,
                            easeLinearity: ease,
                            noMoveStart: true
                        });
                    });
                }
            }
        }
    });

    L.Map.addInitHook('addHandler', 'dragging', L.Map.Drag);


    /*
     * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
     */

    L.Map.mergeOptions({
        doubleClickZoom: true
    });

    L.Map.DoubleClickZoom = L.Handler.extend({
        addHooks: function () {
            this._map.on('dblclick', this._onDoubleClick, this);
        },

        removeHooks: function () {
            this._map.off('dblclick', this._onDoubleClick, this);
        },

        _onDoubleClick: function (e) {
            var map = this._map,
                zoom = map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1);

            if (map.options.doubleClickZoom === 'center') {
                map.setZoom(zoom);
            } else {
                map.setZoomAround(e.containerPoint, zoom);
            }
        }
    });

    L.Map.addInitHook('addHandler', 'doubleClickZoom', L.Map.DoubleClickZoom);


    /*
     * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
     */

    L.Map.mergeOptions({
        scrollWheelZoom: true
    });

    L.Map.ScrollWheelZoom = L.Handler.extend({
        addHooks: function () {
            L.DomEvent.on(this._map._container, 'mousewheel', this._onWheelScroll, this);
            L.DomEvent.on(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
            this._delta = 0;
        },

        removeHooks: function () {
            L.DomEvent.off(this._map._container, 'mousewheel', this._onWheelScroll);
            L.DomEvent.off(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
        },

        _onWheelScroll: function (e) {
            var delta = L.DomEvent.getWheelDelta(e);

            this._delta += delta;
            this._lastMousePos = this._map.mouseEventToContainerPoint(e);

            if (!this._startTime) {
                this._startTime = +new Date();
            }

            var left = Math.max(40 - (+new Date() - this._startTime), 0);

            clearTimeout(this._timer);
            this._timer = setTimeout(L.bind(this._performZoom, this), left);

            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
        },

        _performZoom: function () {
            var map = this._map,
                delta = this._delta,
                zoom = map.getZoom();

            delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
            delta = Math.max(Math.min(delta, 4), -4);
            delta = map._limitZoom(zoom + delta) - zoom;

            this._delta = 0;
            this._startTime = null;

            if (!delta) { return; }

            if (map.options.scrollWheelZoom === 'center') {
                map.setZoom(zoom + delta);
            } else {
                map.setZoomAround(this._lastMousePos, zoom + delta);
            }
        }
    });

    L.Map.addInitHook('addHandler', 'scrollWheelZoom', L.Map.ScrollWheelZoom);


    /*
     * Extends the event handling code with double tap support for mobile browsers.
     */

    L.extend(L.DomEvent, {

        _touchstart: L.Browser.msPointer ? 'MSPointerDown' : L.Browser.pointer ? 'pointerdown' : 'touchstart',
        _touchend: L.Browser.msPointer ? 'MSPointerUp' : L.Browser.pointer ? 'pointerup' : 'touchend',

        // inspired by Zepto touch code by Thomas Fuchs
        addDoubleTapListener: function (obj, handler, id) {
            var last,
                doubleTap = false,
                delay = 250,
                touch,
                pre = '_leaflet_',
                touchstart = this._touchstart,
                touchend = this._touchend,
                trackedTouches = [];

            function onTouchStart(e) {
                var count;

                if (L.Browser.pointer) {
                    trackedTouches.push(e.pointerId);
                    count = trackedTouches.length;
                } else {
                    count = e.touches.length;
                }
                if (count > 1) {
                    return;
                }

                var now = Date.now(),
                    delta = now - (last || now);

                touch = e.touches ? e.touches[0] : e;
                doubleTap = (delta > 0 && delta <= delay);
                last = now;
            }

            function onTouchEnd(e) {
                if (L.Browser.pointer) {
                    var idx = trackedTouches.indexOf(e.pointerId);
                    if (idx === -1) {
                        return;
                    }
                    trackedTouches.splice(idx, 1);
                }

                if (doubleTap) {
                    if (L.Browser.pointer) {
                        // work around .type being readonly with MSPointer* events
                        var newTouch = { },
                            prop;

                        // jshint forin:false
                        for (var i in touch) {
                            prop = touch[i];
                            if (typeof prop === 'function') {
                                newTouch[i] = prop.bind(touch);
                            } else {
                                newTouch[i] = prop;
                            }
                        }
                        touch = newTouch;
                    }
                    touch.type = 'dblclick';
                    handler(touch);
                    last = null;
                }
            }
            obj[pre + touchstart + id] = onTouchStart;
            obj[pre + touchend + id] = onTouchEnd;

            // on pointer we need to listen on the document, otherwise a drag starting on the map and moving off screen
            // will not come through to us, so we will lose track of how many touches are ongoing
            var endElement = L.Browser.pointer ? document.documentElement : obj;

            obj.addEventListener(touchstart, onTouchStart, false);
            endElement.addEventListener(touchend, onTouchEnd, false);

            if (L.Browser.pointer) {
                endElement.addEventListener(L.DomEvent.POINTER_CANCEL, onTouchEnd, false);
            }

            return this;
        },

        removeDoubleTapListener: function (obj, id) {
            var pre = '_leaflet_';

            obj.removeEventListener(this._touchstart, obj[pre + this._touchstart + id], false);
            (L.Browser.pointer ? document.documentElement : obj).removeEventListener(
                    this._touchend, obj[pre + this._touchend + id], false);

            if (L.Browser.pointer) {
                document.documentElement.removeEventListener(L.DomEvent.POINTER_CANCEL, obj[pre + this._touchend + id],
                    false);
            }

            return this;
        }
    });


    /*
     * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
     */

    L.extend(L.DomEvent, {

        //static
        POINTER_DOWN: L.Browser.msPointer ? 'MSPointerDown' : 'pointerdown',
        POINTER_MOVE: L.Browser.msPointer ? 'MSPointerMove' : 'pointermove',
        POINTER_UP: L.Browser.msPointer ? 'MSPointerUp' : 'pointerup',
        POINTER_CANCEL: L.Browser.msPointer ? 'MSPointerCancel' : 'pointercancel',

        _pointers: [],
        _pointerDocumentListener: false,

        // Provides a touch events wrapper for (ms)pointer events.
        // Based on changes by veproza https://github.com/CloudMade/Leaflet/pull/1019
        //ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

        addPointerListener: function (obj, type, handler, id) {

            switch (type) {
            case 'touchstart':
                return this.addPointerListenerStart(obj, type, handler, id);
            case 'touchend':
                return this.addPointerListenerEnd(obj, type, handler, id);
            case 'touchmove':
                return this.addPointerListenerMove(obj, type, handler, id);
            default:
                throw 'Unknown touch event type';
            }
        },

        addPointerListenerStart: function (obj, type, handler, id) {
            var pre = '_leaflet_',
                pointers = this._pointers;

            var cb = function (e) {

                L.DomEvent.preventDefault(e);

                var alreadyInArray = false;
                for (var i = 0; i < pointers.length; i++) {
                    if (pointers[i].pointerId === e.pointerId) {
                        alreadyInArray = true;
                        break;
                    }
                }
                if (!alreadyInArray) {
                    pointers.push(e);
                }

                e.touches = pointers.slice();
                e.changedTouches = [e];

                handler(e);
            };

            obj[pre + 'touchstart' + id] = cb;
            obj.addEventListener(this.POINTER_DOWN, cb, false);

            // need to also listen for end events to keep the _pointers list accurate
            // this needs to be on the body and never go away
            if (!this._pointerDocumentListener) {
                var internalCb = function (e) {
                    for (var i = 0; i < pointers.length; i++) {
                        if (pointers[i].pointerId === e.pointerId) {
                            pointers.splice(i, 1);
                            break;
                        }
                    }
                };
                //We listen on the documentElement as any drags that end by moving the touch off the screen get fired there
                document.documentElement.addEventListener(this.POINTER_UP, internalCb, false);
                document.documentElement.addEventListener(this.POINTER_CANCEL, internalCb, false);

                this._pointerDocumentListener = true;
            }

            return this;
        },

        addPointerListenerMove: function (obj, type, handler, id) {
            var pre = '_leaflet_',
                touches = this._pointers;

            function cb(e) {

                // don't fire touch moves when mouse isn't down
                if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

                for (var i = 0; i < touches.length; i++) {
                    if (touches[i].pointerId === e.pointerId) {
                        touches[i] = e;
                        break;
                    }
                }

                e.touches = touches.slice();
                e.changedTouches = [e];

                handler(e);
            }

            obj[pre + 'touchmove' + id] = cb;
            obj.addEventListener(this.POINTER_MOVE, cb, false);

            return this;
        },

        addPointerListenerEnd: function (obj, type, handler, id) {
            var pre = '_leaflet_',
                touches = this._pointers;

            var cb = function (e) {
                for (var i = 0; i < touches.length; i++) {
                    if (touches[i].pointerId === e.pointerId) {
                        touches.splice(i, 1);
                        break;
                    }
                }

                e.touches = touches.slice();
                e.changedTouches = [e];

                handler(e);
            };

            obj[pre + 'touchend' + id] = cb;
            obj.addEventListener(this.POINTER_UP, cb, false);
            obj.addEventListener(this.POINTER_CANCEL, cb, false);

            return this;
        },

        removePointerListener: function (obj, type, id) {
            var pre = '_leaflet_',
                cb = obj[pre + type + id];

            switch (type) {
            case 'touchstart':
                obj.removeEventListener(this.POINTER_DOWN, cb, false);
                break;
            case 'touchmove':
                obj.removeEventListener(this.POINTER_MOVE, cb, false);
                break;
            case 'touchend':
                obj.removeEventListener(this.POINTER_UP, cb, false);
                obj.removeEventListener(this.POINTER_CANCEL, cb, false);
                break;
            }

            return this;
        }
    });


    /*
     * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
     */

    L.Map.mergeOptions({
        touchZoom: L.Browser.touch && !L.Browser.android23,
        bounceAtZoomLimits: true
    });

    L.Map.TouchZoom = L.Handler.extend({
        addHooks: function () {
            L.DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
        },

        removeHooks: function () {
            L.DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
        },

        _onTouchStart: function (e) {
            var map = this._map;

            if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

            var p1 = map.mouseEventToLayerPoint(e.touches[0]),
                p2 = map.mouseEventToLayerPoint(e.touches[1]),
                viewCenter = map._getCenterLayerPoint();

            this._startCenter = p1.add(p2)._divideBy(2);
            this._startDist = p1.distanceTo(p2);

            this._moved = false;
            this._zooming = true;

            this._centerOffset = viewCenter.subtract(this._startCenter);

            if (map._panAnim) {
                map._panAnim.stop();
            }

            L.DomEvent
                .on(document, 'touchmove', this._onTouchMove, this)
                .on(document, 'touchend', this._onTouchEnd, this);

            L.DomEvent.preventDefault(e);
        },

        _onTouchMove: function (e) {
            var map = this._map;

            if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

            var p1 = map.mouseEventToLayerPoint(e.touches[0]),
                p2 = map.mouseEventToLayerPoint(e.touches[1]);

            this._scale = p1.distanceTo(p2) / this._startDist;
            this._delta = p1._add(p2)._divideBy(2)._subtract(this._startCenter);

            if (this._scale === 1) { return; }

            if (!map.options.bounceAtZoomLimits) {
                if ((map.getZoom() === map.getMinZoom() && this._scale < 1) ||
                    (map.getZoom() === map.getMaxZoom() && this._scale > 1)) { return; }
            }

            if (!this._moved) {
                L.DomUtil.addClass(map._mapPane, 'leaflet-touching');

                map
                    .fire('movestart')
                    .fire('zoomstart');

                this._moved = true;
            }

            L.Util.cancelAnimFrame(this._animRequest);
            this._animRequest = L.Util.requestAnimFrame(
                    this._updateOnMove, this, true, this._map._container);

            L.DomEvent.preventDefault(e);
        },

        _updateOnMove: function () {
            var map = this._map,
                origin = this._getScaleOrigin(),
                center = map.layerPointToLatLng(origin),
                zoom = map.getScaleZoom(this._scale);

            map._animateZoom(center, zoom, this._startCenter, this._scale, this._delta);
        },

        _onTouchEnd: function () {
            if (!this._moved || !this._zooming) {
                this._zooming = false;
                return;
            }

            var map = this._map;

            this._zooming = false;
            L.DomUtil.removeClass(map._mapPane, 'leaflet-touching');
            L.Util.cancelAnimFrame(this._animRequest);

            L.DomEvent
                .off(document, 'touchmove', this._onTouchMove)
                .off(document, 'touchend', this._onTouchEnd);

            var origin = this._getScaleOrigin(),
                center = map.layerPointToLatLng(origin),

                oldZoom = map.getZoom(),
                floatZoomDelta = map.getScaleZoom(this._scale) - oldZoom,
                roundZoomDelta = (floatZoomDelta > 0 ?
                        Math.ceil(floatZoomDelta) : Math.floor(floatZoomDelta)),

                zoom = map._limitZoom(oldZoom + roundZoomDelta),
                scale = map.getZoomScale(zoom) / this._scale;

            map._animateZoom(center, zoom, origin, scale);
        },

        _getScaleOrigin: function () {
            var centerOffset = this._centerOffset.subtract(this._delta).divideBy(this._scale);
            return this._startCenter.add(centerOffset);
        }
    });

    L.Map.addInitHook('addHandler', 'touchZoom', L.Map.TouchZoom);


    /*
     * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
     */

    L.Map.mergeOptions({
        tap: true,
        tapTolerance: 15
    });

    L.Map.Tap = L.Handler.extend({
        addHooks: function () {
            L.DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
        },

        removeHooks: function () {
            L.DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
        },

        _onDown: function (e) {
            if (!e.touches) { return; }

            L.DomEvent.preventDefault(e);

            this._fireClick = true;

            // don't simulate click or track longpress if more than 1 touch
            if (e.touches.length > 1) {
                this._fireClick = false;
                clearTimeout(this._holdTimeout);
                return;
            }

            var first = e.touches[0],
                el = first.target;

            this._startPos = this._newPos = new L.Point(first.clientX, first.clientY);

            // if touching a link, highlight it
            if (el.tagName && el.tagName.toLowerCase() === 'a') {
                L.DomUtil.addClass(el, 'leaflet-active');
            }

            // simulate long hold but setting a timeout
            this._holdTimeout = setTimeout(L.bind(function () {
                if (this._isTapValid()) {
                    this._fireClick = false;
                    this._onUp();
                    this._simulateEvent('contextmenu', first);
                }
            }, this), 1000);

            L.DomEvent
                .on(document, 'touchmove', this._onMove, this)
                .on(document, 'touchend', this._onUp, this);
        },

        _onUp: function (e) {
            clearTimeout(this._holdTimeout);

            L.DomEvent
                .off(document, 'touchmove', this._onMove, this)
                .off(document, 'touchend', this._onUp, this);

            if (this._fireClick && e && e.changedTouches) {

                var first = e.changedTouches[0],
                    el = first.target;

                if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
                    L.DomUtil.removeClass(el, 'leaflet-active');
                }

                // simulate click if the touch didn't move too much
                if (this._isTapValid()) {
                    this._simulateEvent('click', first);
                }
            }
        },

        _isTapValid: function () {
            return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
        },

        _onMove: function (e) {
            var first = e.touches[0];
            this._newPos = new L.Point(first.clientX, first.clientY);
        },

        _simulateEvent: function (type, e) {
            var simulatedEvent = document.createEvent('MouseEvents');

            simulatedEvent._simulated = true;
            e.target._simulatedClick = true;

            simulatedEvent.initMouseEvent(
                    type, true, true, window, 1,
                    e.screenX, e.screenY,
                    e.clientX, e.clientY,
                    false, false, false, false, 0, null);

            e.target.dispatchEvent(simulatedEvent);
        }
    });

    if (L.Browser.touch && !L.Browser.pointer) {
        L.Map.addInitHook('addHandler', 'tap', L.Map.Tap);
    }


    /*
     * L.Handler.ShiftDragZoom is used to add shift-drag zoom interaction to the map
      * (zoom to a selected bounding box), enabled by default.
     */

    L.Map.mergeOptions({
        boxZoom: true
    });

    L.Map.BoxZoom = L.Handler.extend({
        initialize: function (map) {
            this._map = map;
            this._container = map._container;
            this._pane = map._panes.overlayPane;
            this._moved = false;
        },

        addHooks: function () {
            L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
        },

        removeHooks: function () {
            L.DomEvent.off(this._container, 'mousedown', this._onMouseDown);
            this._moved = false;
        },

        moved: function () {
            return this._moved;
        },

        _onMouseDown: function (e) {
            this._moved = false;

            if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

            L.DomUtil.disableTextSelection();
            L.DomUtil.disableImageDrag();

            this._startLayerPoint = this._map.mouseEventToLayerPoint(e);

            L.DomEvent
                .on(document, 'mousemove', this._onMouseMove, this)
                .on(document, 'mouseup', this._onMouseUp, this)
                .on(document, 'keydown', this._onKeyDown, this);
        },

        _onMouseMove: function (e) {
            if (!this._moved) {
                this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._pane);
                L.DomUtil.setPosition(this._box, this._startLayerPoint);

                //TODO refactor: move cursor to styles
                this._container.style.cursor = 'crosshair';
                this._map.fire('boxzoomstart');
            }

            var startPoint = this._startLayerPoint,
                box = this._box,

                layerPoint = this._map.mouseEventToLayerPoint(e),
                offset = layerPoint.subtract(startPoint),

                newPos = new L.Point(
                    Math.min(layerPoint.x, startPoint.x),
                    Math.min(layerPoint.y, startPoint.y));

            L.DomUtil.setPosition(box, newPos);

            this._moved = true;

            // TODO refactor: remove hardcoded 4 pixels
            box.style.width  = (Math.max(0, Math.abs(offset.x) - 4)) + 'px';
            box.style.height = (Math.max(0, Math.abs(offset.y) - 4)) + 'px';
        },

        _finish: function () {
            if (this._moved) {
                this._pane.removeChild(this._box);
                this._container.style.cursor = '';
            }

            L.DomUtil.enableTextSelection();
            L.DomUtil.enableImageDrag();

            L.DomEvent
                .off(document, 'mousemove', this._onMouseMove)
                .off(document, 'mouseup', this._onMouseUp)
                .off(document, 'keydown', this._onKeyDown);
        },

        _onMouseUp: function (e) {

            this._finish();

            var map = this._map,
                layerPoint = map.mouseEventToLayerPoint(e);

            if (this._startLayerPoint.equals(layerPoint)) { return; }

            var bounds = new L.LatLngBounds(
                    map.layerPointToLatLng(this._startLayerPoint),
                    map.layerPointToLatLng(layerPoint));

            map.fitBounds(bounds);

            map.fire('boxzoomend', {
                boxZoomBounds: bounds
            });
        },

        _onKeyDown: function (e) {
            if (e.keyCode === 27) {
                this._finish();
            }
        }
    });

    L.Map.addInitHook('addHandler', 'boxZoom', L.Map.BoxZoom);


    /*
     * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
     */

    L.Map.mergeOptions({
        keyboard: true,
        keyboardPanOffset: 80,
        keyboardZoomOffset: 1
    });

    L.Map.Keyboard = L.Handler.extend({

        keyCodes: {
            left:    [37],
            right:   [39],
            down:    [40],
            up:      [38],
            zoomIn:  [187, 107, 61, 171],
            zoomOut: [189, 109, 173]
        },

        initialize: function (map) {
            this._map = map;

            this._setPanOffset(map.options.keyboardPanOffset);
            this._setZoomOffset(map.options.keyboardZoomOffset);
        },

        addHooks: function () {
            var container = this._map._container;

            // make the container focusable by tabbing
            if (container.tabIndex === -1) {
                container.tabIndex = '0';
            }

            L.DomEvent
                .on(container, 'focus', this._onFocus, this)
                .on(container, 'blur', this._onBlur, this)
                .on(container, 'mousedown', this._onMouseDown, this);

            this._map
                .on('focus', this._addHooks, this)
                .on('blur', this._removeHooks, this);
        },

        removeHooks: function () {
            this._removeHooks();

            var container = this._map._container;

            L.DomEvent
                .off(container, 'focus', this._onFocus, this)
                .off(container, 'blur', this._onBlur, this)
                .off(container, 'mousedown', this._onMouseDown, this);

            this._map
                .off('focus', this._addHooks, this)
                .off('blur', this._removeHooks, this);
        },

        _onMouseDown: function () {
            if (this._focused) { return; }

            var body = document.body,
                docEl = document.documentElement,
                top = body.scrollTop || docEl.scrollTop,
                left = body.scrollLeft || docEl.scrollLeft;

            this._map._container.focus();

            window.scrollTo(left, top);
        },

        _onFocus: function () {
            this._focused = true;
            this._map.fire('focus');
        },

        _onBlur: function () {
            this._focused = false;
            this._map.fire('blur');
        },

        _setPanOffset: function (pan) {
            var keys = this._panKeys = {},
                codes = this.keyCodes,
                i, len;

            for (i = 0, len = codes.left.length; i < len; i++) {
                keys[codes.left[i]] = [-1 * pan, 0];
            }
            for (i = 0, len = codes.right.length; i < len; i++) {
                keys[codes.right[i]] = [pan, 0];
            }
            for (i = 0, len = codes.down.length; i < len; i++) {
                keys[codes.down[i]] = [0, pan];
            }
            for (i = 0, len = codes.up.length; i < len; i++) {
                keys[codes.up[i]] = [0, -1 * pan];
            }
        },

        _setZoomOffset: function (zoom) {
            var keys = this._zoomKeys = {},
                codes = this.keyCodes,
                i, len;

            for (i = 0, len = codes.zoomIn.length; i < len; i++) {
                keys[codes.zoomIn[i]] = zoom;
            }
            for (i = 0, len = codes.zoomOut.length; i < len; i++) {
                keys[codes.zoomOut[i]] = -zoom;
            }
        },

        _addHooks: function () {
            L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
        },

        _removeHooks: function () {
            L.DomEvent.off(document, 'keydown', this._onKeyDown, this);
        },

        _onKeyDown: function (e) {
            var key = e.keyCode,
                map = this._map;

            if (key in this._panKeys) {

                if (map._panAnim && map._panAnim._inProgress) { return; }

                map.panBy(this._panKeys[key]);

                if (map.options.maxBounds) {
                    map.panInsideBounds(map.options.maxBounds);
                }

            } else if (key in this._zoomKeys) {
                map.setZoom(map.getZoom() + this._zoomKeys[key]);

            } else {
                return;
            }

            L.DomEvent.stop(e);
        }
    });

    L.Map.addInitHook('addHandler', 'keyboard', L.Map.Keyboard);


    /*
     * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
     */

    L.Handler.MarkerDrag = L.Handler.extend({
        initialize: function (marker) {
            this._marker = marker;
        },

        addHooks: function () {
            var icon = this._marker._icon;
            if (!this._draggable) {
                this._draggable = new L.Draggable(icon, icon);
            }

            this._draggable
                .on('dragstart', this._onDragStart, this)
                .on('drag', this._onDrag, this)
                .on('dragend', this._onDragEnd, this);
            this._draggable.enable();
            L.DomUtil.addClass(this._marker._icon, 'leaflet-marker-draggable');
        },

        removeHooks: function () {
            this._draggable
                .off('dragstart', this._onDragStart, this)
                .off('drag', this._onDrag, this)
                .off('dragend', this._onDragEnd, this);

            this._draggable.disable();
            L.DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
        },

        moved: function () {
            return this._draggable && this._draggable._moved;
        },

        _onDragStart: function () {
            this._marker
                .closePopup()
                .fire('movestart')
                .fire('dragstart');
        },

        _onDrag: function () {
            var marker = this._marker,
                shadow = marker._shadow,
                iconPos = L.DomUtil.getPosition(marker._icon),
                latlng = marker._map.layerPointToLatLng(iconPos);

            // update shadow position
            if (shadow) {
                L.DomUtil.setPosition(shadow, iconPos);
            }

            marker._latlng = latlng;

            marker
                .fire('move', {latlng: latlng})
                .fire('drag');
        },

        _onDragEnd: function (e) {
            this._marker
                .fire('moveend')
                .fire('dragend', e);
        }
    });


    /*
     * L.Control is a base class for implementing map controls. Handles positioning.
     * All other controls extend from this class.
     */

    L.Control = L.Class.extend({
        options: {
            position: 'topright'
        },

        initialize: function (options) {
            L.setOptions(this, options);
        },

        getPosition: function () {
            return this.options.position;
        },

        setPosition: function (position) {
            var map = this._map;

            if (map) {
                map.removeControl(this);
            }

            this.options.position = position;

            if (map) {
                map.addControl(this);
            }

            return this;
        },

        getContainer: function () {
            return this._container;
        },

        addTo: function (map) {
            this._map = map;

            var container = this._container = this.onAdd(map),
                pos = this.getPosition(),
                corner = map._controlCorners[pos];

            L.DomUtil.addClass(container, 'leaflet-control');

            if (pos.indexOf('bottom') !== -1) {
                corner.insertBefore(container, corner.firstChild);
            } else {
                corner.appendChild(container);
            }

            return this;
        },

        removeFrom: function (map) {
            var pos = this.getPosition(),
                corner = map._controlCorners[pos];

            corner.removeChild(this._container);
            this._map = null;

            if (this.onRemove) {
                this.onRemove(map);
            }

            return this;
        },

        _refocusOnMap: function () {
            if (this._map) {
                this._map.getContainer().focus();
            }
        }
    });

    L.control = function (options) {
        return new L.Control(options);
    };


    // adds control-related methods to L.Map

    L.Map.include({
        addControl: function (control) {
            control.addTo(this);
            return this;
        },

        removeControl: function (control) {
            control.removeFrom(this);
            return this;
        },

        _initControlPos: function () {
            var corners = this._controlCorners = {},
                l = 'leaflet-',
                container = this._controlContainer =
                        L.DomUtil.create('div', l + 'control-container', this._container);

            function createCorner(vSide, hSide) {
                var className = l + vSide + ' ' + l + hSide;

                corners[vSide + hSide] = L.DomUtil.create('div', className, container);
            }

            createCorner('top', 'left');
            createCorner('top', 'right');
            createCorner('bottom', 'left');
            createCorner('bottom', 'right');
        },

        _clearControlPos: function () {
            this._container.removeChild(this._controlContainer);
        }
    });


    /*
     * L.Control.Zoom is used for the default zoom buttons on the map.
     */

    L.Control.Zoom = L.Control.extend({
        options: {
            position: 'topleft',
            zoomInText: '+',
            zoomInTitle: 'Zoom in',
            zoomOutText: '-',
            zoomOutTitle: 'Zoom out'
        },

        onAdd: function (map) {
            var zoomName = 'leaflet-control-zoom',
                container = L.DomUtil.create('div', zoomName + ' leaflet-bar');

            this._map = map;

            this._zoomInButton  = this._createButton(
                    this.options.zoomInText, this.options.zoomInTitle,
                    zoomName + '-in',  container, this._zoomIn,  this);
            this._zoomOutButton = this._createButton(
                    this.options.zoomOutText, this.options.zoomOutTitle,
                    zoomName + '-out', container, this._zoomOut, this);

            this._updateDisabled();
            map.on('zoomend zoomlevelschange', this._updateDisabled, this);

            return container;
        },

        onRemove: function (map) {
            map.off('zoomend zoomlevelschange', this._updateDisabled, this);
        },

        _zoomIn: function (e) {
            this._map.zoomIn(e.shiftKey ? 3 : 1);
        },

        _zoomOut: function (e) {
            this._map.zoomOut(e.shiftKey ? 3 : 1);
        },

        _createButton: function (html, title, className, container, fn, context) {
            var link = L.DomUtil.create('a', className, container);
            link.innerHTML = html;
            link.href = '#';
            link.title = title;

            var stop = L.DomEvent.stopPropagation;

            L.DomEvent
                .on(link, 'click', stop)
                .on(link, 'mousedown', stop)
                .on(link, 'dblclick', stop)
                .on(link, 'click', L.DomEvent.preventDefault)
                .on(link, 'click', fn, context)
                .on(link, 'click', this._refocusOnMap, context);

            return link;
        },

        _updateDisabled: function () {
            var map = this._map,
                className = 'leaflet-disabled';

            L.DomUtil.removeClass(this._zoomInButton, className);
            L.DomUtil.removeClass(this._zoomOutButton, className);

            if (map._zoom === map.getMinZoom()) {
                L.DomUtil.addClass(this._zoomOutButton, className);
            }
            if (map._zoom === map.getMaxZoom()) {
                L.DomUtil.addClass(this._zoomInButton, className);
            }
        }
    });

    L.Map.mergeOptions({
        zoomControl: true
    });

    L.Map.addInitHook(function () {
        if (this.options.zoomControl) {
            this.zoomControl = new L.Control.Zoom();
            this.addControl(this.zoomControl);
        }
    });

    L.control.zoom = function (options) {
        return new L.Control.Zoom(options);
    };



    /*
     * L.Control.Attribution is used for displaying attribution on the map (added by default).
     */

    L.Control.Attribution = L.Control.extend({
        options: {
            position: 'bottomright',
            prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
        },

        initialize: function (options) {
            L.setOptions(this, options);

            this._attributions = {};
        },

        onAdd: function (map) {
            this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
            L.DomEvent.disableClickPropagation(this._container);

            for (var i in map._layers) {
                if (map._layers[i].getAttribution) {
                    this.addAttribution(map._layers[i].getAttribution());
                }
            }

            map
                .on('layeradd', this._onLayerAdd, this)
                .on('layerremove', this._onLayerRemove, this);

            this._update();

            return this._container;
        },

        onRemove: function (map) {
            map
                .off('layeradd', this._onLayerAdd)
                .off('layerremove', this._onLayerRemove);

        },

        setPrefix: function (prefix) {
            this.options.prefix = prefix;
            this._update();
            return this;
        },

        addAttribution: function (text) {
            if (!text) { return; }

            if (!this._attributions[text]) {
                this._attributions[text] = 0;
            }
            this._attributions[text]++;

            this._update();

            return this;
        },

        removeAttribution: function (text) {
            if (!text) { return; }

            if (this._attributions[text]) {
                this._attributions[text]--;
                this._update();
            }

            return this;
        },

        _update: function () {
            if (!this._map) { return; }

            var attribs = [];

            for (var i in this._attributions) {
                if (this._attributions[i]) {
                    attribs.push(i);
                }
            }

            var prefixAndAttribs = [];

            if (this.options.prefix) {
                prefixAndAttribs.push(this.options.prefix);
            }
            if (attribs.length) {
                prefixAndAttribs.push(attribs.join(', '));
            }

            this._container.innerHTML = prefixAndAttribs.join(' | ');
        },

        _onLayerAdd: function (e) {
            if (e.layer.getAttribution) {
                this.addAttribution(e.layer.getAttribution());
            }
        },

        _onLayerRemove: function (e) {
            if (e.layer.getAttribution) {
                this.removeAttribution(e.layer.getAttribution());
            }
        }
    });

    L.Map.mergeOptions({
        attributionControl: true
    });

    L.Map.addInitHook(function () {
        if (this.options.attributionControl) {
            this.attributionControl = (new L.Control.Attribution()).addTo(this);
        }
    });

    L.control.attribution = function (options) {
        return new L.Control.Attribution(options);
    };


    /*
     * L.Control.Scale is used for displaying metric/imperial scale on the map.
     */

    L.Control.Scale = L.Control.extend({
        options: {
            position: 'bottomleft',
            maxWidth: 100,
            metric: true,
            imperial: true,
            updateWhenIdle: false
        },

        onAdd: function (map) {
            this._map = map;

            var className = 'leaflet-control-scale',
                container = L.DomUtil.create('div', className),
                options = this.options;

            this._addScales(options, className, container);

            map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
            map.whenReady(this._update, this);

            return container;
        },

        onRemove: function (map) {
            map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
        },

        _addScales: function (options, className, container) {
            if (options.metric) {
                this._mScale = L.DomUtil.create('div', className + '-line', container);
            }
            if (options.imperial) {
                this._iScale = L.DomUtil.create('div', className + '-line', container);
            }
        },

        _update: function () {
            var bounds = this._map.getBounds(),
                centerLat = bounds.getCenter().lat,
                halfWorldMeters = 6378137 * Math.PI * Math.cos(centerLat * Math.PI / 180),
                dist = halfWorldMeters * (bounds.getNorthEast().lng - bounds.getSouthWest().lng) / 180,

                size = this._map.getSize(),
                options = this.options,
                maxMeters = 0;

            if (size.x > 0) {
                maxMeters = dist * (options.maxWidth / size.x);
            }

            this._updateScales(options, maxMeters);
        },

        _updateScales: function (options, maxMeters) {
            if (options.metric && maxMeters) {
                this._updateMetric(maxMeters);
            }

            if (options.imperial && maxMeters) {
                this._updateImperial(maxMeters);
            }
        },

        _updateMetric: function (maxMeters) {
            var meters = this._getRoundNum(maxMeters);

            this._mScale.style.width = this._getScaleWidth(meters / maxMeters) + 'px';
            this._mScale.innerHTML = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';
        },

        _updateImperial: function (maxMeters) {
            var maxFeet = maxMeters * 3.2808399,
                scale = this._iScale,
                maxMiles, miles, feet;

            if (maxFeet > 5280) {
                maxMiles = maxFeet / 5280;
                miles = this._getRoundNum(maxMiles);

                scale.style.width = this._getScaleWidth(miles / maxMiles) + 'px';
                scale.innerHTML = miles + ' mi';

            } else {
                feet = this._getRoundNum(maxFeet);

                scale.style.width = this._getScaleWidth(feet / maxFeet) + 'px';
                scale.innerHTML = feet + ' ft';
            }
        },

        _getScaleWidth: function (ratio) {
            return Math.round(this.options.maxWidth * ratio) - 10;
        },

        _getRoundNum: function (num) {
            var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
                d = num / pow10;

            d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;

            return pow10 * d;
        }
    });

    L.control.scale = function (options) {
        return new L.Control.Scale(options);
    };


    /*
     * L.Control.Layers is a control to allow users to switch between different layers on the map.
     */

    L.Control.Layers = L.Control.extend({
        options: {
            collapsed: true,
            position: 'topright',
            autoZIndex: true
        },

        initialize: function (baseLayers, overlays, options) {
            L.setOptions(this, options);

            this._layers = {};
            this._lastZIndex = 0;
            this._handlingClick = false;

            for (var i in baseLayers) {
                this._addLayer(baseLayers[i], i);
            }

            for (i in overlays) {
                this._addLayer(overlays[i], i, true);
            }
        },

        onAdd: function (map) {
            this._initLayout();
            this._update();

            map
                .on('layeradd', this._onLayerChange, this)
                .on('layerremove', this._onLayerChange, this);

            return this._container;
        },

        onRemove: function (map) {
            map
                .off('layeradd', this._onLayerChange)
                .off('layerremove', this._onLayerChange);
        },

        addBaseLayer: function (layer, name) {
            this._addLayer(layer, name);
            this._update();
            return this;
        },

        addOverlay: function (layer, name) {
            this._addLayer(layer, name, true);
            this._update();
            return this;
        },

        removeLayer: function (layer) {
            var id = L.stamp(layer);
            delete this._layers[id];
            this._update();
            return this;
        },

        _initLayout: function () {
            var className = 'leaflet-control-layers',
                container = this._container = L.DomUtil.create('div', className);

            //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
            container.setAttribute('aria-haspopup', true);

            if (!L.Browser.touch) {
                L.DomEvent
                    .disableClickPropagation(container)
                    .disableScrollPropagation(container);
            } else {
                L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
            }

            var form = this._form = L.DomUtil.create('form', className + '-list');

            if (this.options.collapsed) {
                if (!L.Browser.android) {
                    L.DomEvent
                        .on(container, 'mouseover', this._expand, this)
                        .on(container, 'mouseout', this._collapse, this);
                }
                var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
                link.href = '#';
                link.title = 'Layers';

                if (L.Browser.touch) {
                    L.DomEvent
                        .on(link, 'click', L.DomEvent.stop)
                        .on(link, 'click', this._expand, this);
                }
                else {
                    L.DomEvent.on(link, 'focus', this._expand, this);
                }
                //Work around for Firefox android issue https://github.com/Leaflet/Leaflet/issues/2033
                L.DomEvent.on(form, 'click', function () {
                    setTimeout(L.bind(this._onInputClick, this), 0);
                }, this);

                this._map.on('click', this._collapse, this);
                // TODO keyboard accessibility
            } else {
                this._expand();
            }

            this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
            this._separator = L.DomUtil.create('div', className + '-separator', form);
            this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

            container.appendChild(form);
        },

        _addLayer: function (layer, name, overlay) {
            var id = L.stamp(layer);

            this._layers[id] = {
                layer: layer,
                name: name,
                overlay: overlay
            };

            if (this.options.autoZIndex && layer.setZIndex) {
                this._lastZIndex++;
                layer.setZIndex(this._lastZIndex);
            }
        },

        _update: function () {
            if (!this._container) {
                return;
            }

            this._baseLayersList.innerHTML = '';
            this._overlaysList.innerHTML = '';

            var baseLayersPresent = false,
                overlaysPresent = false,
                i, obj;

            for (i in this._layers) {
                obj = this._layers[i];
                this._addItem(obj);
                overlaysPresent = overlaysPresent || obj.overlay;
                baseLayersPresent = baseLayersPresent || !obj.overlay;
            }

            this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
        },

        _onLayerChange: function (e) {
            var obj = this._layers[L.stamp(e.layer)];

            if (!obj) { return; }

            if (!this._handlingClick) {
                this._update();
            }

            var type = obj.overlay ?
                (e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
                (e.type === 'layeradd' ? 'baselayerchange' : null);

            if (type) {
                this._map.fire(type, obj);
            }
        },

        // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
        _createRadioElement: function (name, checked) {

            var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
            if (checked) {
                radioHtml += ' checked="checked"';
            }
            radioHtml += '/>';

            var radioFragment = document.createElement('div');
            radioFragment.innerHTML = radioHtml;

            return radioFragment.firstChild;
        },

        _addItem: function (obj) {
            var label = document.createElement('label'),
                input,
                checked = this._map.hasLayer(obj.layer);

            if (obj.overlay) {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'leaflet-control-layers-selector';
                input.defaultChecked = checked;
            } else {
                input = this._createRadioElement('leaflet-base-layers', checked);
            }

            input.layerId = L.stamp(obj.layer);

            L.DomEvent.on(input, 'click', this._onInputClick, this);

            var name = document.createElement('span');
            name.innerHTML = ' ' + obj.name;

            label.appendChild(input);
            label.appendChild(name);

            var container = obj.overlay ? this._overlaysList : this._baseLayersList;
            container.appendChild(label);

            return label;
        },

        _onInputClick: function () {
            var i, input, obj,
                inputs = this._form.getElementsByTagName('input'),
                inputsLen = inputs.length;

            this._handlingClick = true;

            for (i = 0; i < inputsLen; i++) {
                input = inputs[i];
                obj = this._layers[input.layerId];

                if (input.checked && !this._map.hasLayer(obj.layer)) {
                    this._map.addLayer(obj.layer);

                } else if (!input.checked && this._map.hasLayer(obj.layer)) {
                    this._map.removeLayer(obj.layer);
                }
            }

            this._handlingClick = false;

            this._refocusOnMap();
        },

        _expand: function () {
            L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
        },

        _collapse: function () {
            this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
        }
    });

    L.control.layers = function (baseLayers, overlays, options) {
        return new L.Control.Layers(baseLayers, overlays, options);
    };


    /*
     * L.PosAnimation is used by Leaflet internally for pan animations.
     */

    L.PosAnimation = L.Class.extend({
        includes: L.Mixin.Events,

        run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
            this.stop();

            this._el = el;
            this._inProgress = true;
            this._newPos = newPos;

            this.fire('start');

            el.style[L.DomUtil.TRANSITION] = 'all ' + (duration || 0.25) +
                    's cubic-bezier(0,0,' + (easeLinearity || 0.5) + ',1)';

            L.DomEvent.on(el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);
            L.DomUtil.setPosition(el, newPos);

            // toggle reflow, Chrome flickers for some reason if you don't do this
            L.Util.falseFn(el.offsetWidth);

            // there's no native way to track value updates of transitioned properties, so we imitate this
            this._stepTimer = setInterval(L.bind(this._onStep, this), 50);
        },

        stop: function () {
            if (!this._inProgress) { return; }

            // if we just removed the transition property, the element would jump to its final position,
            // so we need to make it stay at the current position

            L.DomUtil.setPosition(this._el, this._getPos());
            this._onTransitionEnd();
            L.Util.falseFn(this._el.offsetWidth); // force reflow in case we are about to start a new animation
        },

        _onStep: function () {
            var stepPos = this._getPos();
            if (!stepPos) {
                this._onTransitionEnd();
                return;
            }
            // jshint camelcase: false
            // make L.DomUtil.getPosition return intermediate position value during animation
            this._el._leaflet_pos = stepPos;

            this.fire('step');
        },

        // you can't easily get intermediate values of properties animated with CSS3 Transitions,
        // we need to parse computed style (in case of transform it returns matrix string)

        _transformRe: /([-+]?(?:\d*\.)?\d+)\D*, ([-+]?(?:\d*\.)?\d+)\D*\)/,

        _getPos: function () {
            var left, top, matches,
                el = this._el,
                style = window.getComputedStyle(el);

            if (L.Browser.any3d) {
                matches = style[L.DomUtil.TRANSFORM].match(this._transformRe);
                if (!matches) { return; }
                left = parseFloat(matches[1]);
                top  = parseFloat(matches[2]);
            } else {
                left = parseFloat(style.left);
                top  = parseFloat(style.top);
            }

            return new L.Point(left, top, true);
        },

        _onTransitionEnd: function () {
            L.DomEvent.off(this._el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);

            if (!this._inProgress) { return; }
            this._inProgress = false;

            this._el.style[L.DomUtil.TRANSITION] = '';

            // jshint camelcase: false
            // make sure L.DomUtil.getPosition returns the final position value after animation
            this._el._leaflet_pos = this._newPos;

            clearInterval(this._stepTimer);

            this.fire('step').fire('end');
        }

    });


    /*
     * Extends L.Map to handle panning animations.
     */

    L.Map.include({

        setView: function (center, zoom, options) {

            zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
            center = this._limitCenter(L.latLng(center), zoom, this.options.maxBounds);
            options = options || {};

            if (this._panAnim) {
                this._panAnim.stop();
            }

            if (this._loaded && !options.reset && options !== true) {

                if (options.animate !== undefined) {
                    options.zoom = L.extend({animate: options.animate}, options.zoom);
                    options.pan = L.extend({animate: options.animate}, options.pan);
                }

                // try animating pan or zoom
                var animated = (this._zoom !== zoom) ?
                    this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
                    this._tryAnimatedPan(center, options.pan);

                if (animated) {
                    // prevent resize handler call, the view will refresh after animation anyway
                    clearTimeout(this._sizeTimer);
                    return this;
                }
            }

            // animation didn't start, just reset the map view
            this._resetView(center, zoom);

            return this;
        },

        panBy: function (offset, options) {
            offset = L.point(offset).round();
            options = options || {};

            if (!offset.x && !offset.y) {
                return this;
            }

            if (!this._panAnim) {
                this._panAnim = new L.PosAnimation();

                this._panAnim.on({
                    'step': this._onPanTransitionStep,
                    'end': this._onPanTransitionEnd
                }, this);
            }

            // don't fire movestart if animating inertia
            if (!options.noMoveStart) {
                this.fire('movestart');
            }

            // animate pan unless animate: false specified
            if (options.animate !== false) {
                L.DomUtil.addClass(this._mapPane, 'leaflet-pan-anim');

                var newPos = this._getMapPanePos().subtract(offset);
                this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
            } else {
                this._rawPanBy(offset);
                this.fire('move').fire('moveend');
            }

            return this;
        },

        _onPanTransitionStep: function () {
            this.fire('move');
        },

        _onPanTransitionEnd: function () {
            L.DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
            this.fire('moveend');
        },

        _tryAnimatedPan: function (center, options) {
            // difference between the new and current centers in pixels
            var offset = this._getCenterOffset(center)._floor();

            // don't animate too far unless animate: true specified in options
            if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

            this.panBy(offset, options);

            return true;
        }
    });


    /*
     * L.PosAnimation fallback implementation that powers Leaflet pan animations
     * in browsers that don't support CSS3 Transitions.
     */

    L.PosAnimation = L.DomUtil.TRANSITION ? L.PosAnimation : L.PosAnimation.extend({

        run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
            this.stop();

            this._el = el;
            this._inProgress = true;
            this._duration = duration || 0.25;
            this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

            this._startPos = L.DomUtil.getPosition(el);
            this._offset = newPos.subtract(this._startPos);
            this._startTime = +new Date();

            this.fire('start');

            this._animate();
        },

        stop: function () {
            if (!this._inProgress) { return; }

            this._step();
            this._complete();
        },

        _animate: function () {
            // animation loop
            this._animId = L.Util.requestAnimFrame(this._animate, this);
            this._step();
        },

        _step: function () {
            var elapsed = (+new Date()) - this._startTime,
                duration = this._duration * 1000;

            if (elapsed < duration) {
                this._runFrame(this._easeOut(elapsed / duration));
            } else {
                this._runFrame(1);
                this._complete();
            }
        },

        _runFrame: function (progress) {
            var pos = this._startPos.add(this._offset.multiplyBy(progress));
            L.DomUtil.setPosition(this._el, pos);

            this.fire('step');
        },

        _complete: function () {
            L.Util.cancelAnimFrame(this._animId);

            this._inProgress = false;
            this.fire('end');
        },

        _easeOut: function (t) {
            return 1 - Math.pow(1 - t, this._easeOutPower);
        }
    });


    /*
     * Extends L.Map to handle zoom animations.
     */

    L.Map.mergeOptions({
        zoomAnimation: true,
        zoomAnimationThreshold: 4
    });

    if (L.DomUtil.TRANSITION) {

        L.Map.addInitHook(function () {
            // don't animate on browsers without hardware-accelerated transitions or old Android/Opera
            this._zoomAnimated = this.options.zoomAnimation && L.DomUtil.TRANSITION &&
                    L.Browser.any3d && !L.Browser.android23 && !L.Browser.mobileOpera;

            // zoom transitions run with the same duration for all layers, so if one of transitionend events
            // happens after starting zoom animation (propagating to the map pane), we know that it ended globally
            if (this._zoomAnimated) {
                L.DomEvent.on(this._mapPane, L.DomUtil.TRANSITION_END, this._catchTransitionEnd, this);
            }
        });
    }

    L.Map.include(!L.DomUtil.TRANSITION ? {} : {

        _catchTransitionEnd: function (e) {
            if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
                this._onZoomTransitionEnd();
            }
        },

        _nothingToAnimate: function () {
            return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
        },

        _tryAnimatedZoom: function (center, zoom, options) {

            if (this._animatingZoom) { return true; }

            options = options || {};

            // don't animate if disabled, not supported or zoom difference is too large
            if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
                    Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

            // offset is the pixel coords of the zoom origin relative to the current center
            var scale = this.getZoomScale(zoom),
                offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale),
                origin = this._getCenterLayerPoint()._add(offset);

            // don't animate if the zoom origin isn't within one screen from the current center, unless forced
            if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

            this
                .fire('movestart')
                .fire('zoomstart');

            this._animateZoom(center, zoom, origin, scale, null, true);

            return true;
        },

        _animateZoom: function (center, zoom, origin, scale, delta, backwards) {

            this._animatingZoom = true;

            // put transform transition on all layers with leaflet-zoom-animated class
            L.DomUtil.addClass(this._mapPane, 'leaflet-zoom-anim');

            // remember what center/zoom to set after animation
            this._animateToCenter = center;
            this._animateToZoom = zoom;

            // disable any dragging during animation
            if (L.Draggable) {
                L.Draggable._disabled = true;
            }

            this.fire('zoomanim', {
                center: center,
                zoom: zoom,
                origin: origin,
                scale: scale,
                delta: delta,
                backwards: backwards
            });
        },

        _onZoomTransitionEnd: function () {

            this._animatingZoom = false;

            L.DomUtil.removeClass(this._mapPane, 'leaflet-zoom-anim');

            this._resetView(this._animateToCenter, this._animateToZoom, true, true);

            if (L.Draggable) {
                L.Draggable._disabled = false;
            }
        }
    });


    /*
        Zoom animation logic for L.TileLayer.
    */

    L.TileLayer.include({
        _animateZoom: function (e) {
            if (!this._animating) {
                this._animating = true;
                this._prepareBgBuffer();
            }

            var bg = this._bgBuffer,
                transform = L.DomUtil.TRANSFORM,
                initialTransform = e.delta ? L.DomUtil.getTranslateString(e.delta) : bg.style[transform],
                scaleStr = L.DomUtil.getScaleString(e.scale, e.origin);

            bg.style[transform] = e.backwards ?
                    scaleStr + ' ' + initialTransform :
                    initialTransform + ' ' + scaleStr;
        },

        _endZoomAnim: function () {
            var front = this._tileContainer,
                bg = this._bgBuffer;

            front.style.visibility = '';
            front.parentNode.appendChild(front); // Bring to fore

            // force reflow
            L.Util.falseFn(bg.offsetWidth);

            this._animating = false;
        },

        _clearBgBuffer: function () {
            var map = this._map;

            if (map && !map._animatingZoom && !map.touchZoom._zooming) {
                this._bgBuffer.innerHTML = '';
                this._bgBuffer.style[L.DomUtil.TRANSFORM] = '';
            }
        },

        _prepareBgBuffer: function () {

            var front = this._tileContainer,
                bg = this._bgBuffer;

            // if foreground layer doesn't have many tiles but bg layer does,
            // keep the existing bg layer and just zoom it some more

            var bgLoaded = this._getLoadedTilesPercentage(bg),
                frontLoaded = this._getLoadedTilesPercentage(front);

            if (bg && bgLoaded > 0.5 && frontLoaded < 0.5) {

                front.style.visibility = 'hidden';
                this._stopLoadingImages(front);
                return;
            }

            // prepare the buffer to become the front tile pane
            bg.style.visibility = 'hidden';
            bg.style[L.DomUtil.TRANSFORM] = '';

            // switch out the current layer to be the new bg layer (and vice-versa)
            this._tileContainer = bg;
            bg = this._bgBuffer = front;

            this._stopLoadingImages(bg);

            //prevent bg buffer from clearing right after zoom
            clearTimeout(this._clearBgBufferTimer);
        },

        _getLoadedTilesPercentage: function (container) {
            var tiles = container.getElementsByTagName('img'),
                i, len, count = 0;

            for (i = 0, len = tiles.length; i < len; i++) {
                if (tiles[i].complete) {
                    count++;
                }
            }
            return count / len;
        },

        // stops loading all tiles in the background layer
        _stopLoadingImages: function (container) {
            var tiles = Array.prototype.slice.call(container.getElementsByTagName('img')),
                i, len, tile;

            for (i = 0, len = tiles.length; i < len; i++) {
                tile = tiles[i];

                if (!tile.complete) {
                    tile.onload = L.Util.falseFn;
                    tile.onerror = L.Util.falseFn;
                    tile.src = L.Util.emptyImageUrl;

                    tile.parentNode.removeChild(tile);
                }
            }
        }
    });


    /*
     * Provides L.Map with convenient shortcuts for using browser geolocation features.
     */

    L.Map.include({
        _defaultLocateOptions: {
            watch: false,
            setView: false,
            maxZoom: Infinity,
            timeout: 10000,
            maximumAge: 0,
            enableHighAccuracy: false
        },

        locate: function (/*Object*/ options) {

            options = this._locateOptions = L.extend(this._defaultLocateOptions, options);

            if (!navigator.geolocation) {
                this._handleGeolocationError({
                    code: 0,
                    message: 'Geolocation not supported.'
                });
                return this;
            }

            var onResponse = L.bind(this._handleGeolocationResponse, this),
                onError = L.bind(this._handleGeolocationError, this);

            if (options.watch) {
                this._locationWatchId =
                        navigator.geolocation.watchPosition(onResponse, onError, options);
            } else {
                navigator.geolocation.getCurrentPosition(onResponse, onError, options);
            }
            return this;
        },

        stopLocate: function () {
            if (navigator.geolocation) {
                navigator.geolocation.clearWatch(this._locationWatchId);
            }
            if (this._locateOptions) {
                this._locateOptions.setView = false;
            }
            return this;
        },

        _handleGeolocationError: function (error) {
            var c = error.code,
                message = error.message ||
                        (c === 1 ? 'permission denied' :
                        (c === 2 ? 'position unavailable' : 'timeout'));

            if (this._locateOptions.setView && !this._loaded) {
                this.fitWorld();
            }

            this.fire('locationerror', {
                code: c,
                message: 'Geolocation error: ' + message + '.'
            });
        },

        _handleGeolocationResponse: function (pos) {
            var lat = pos.coords.latitude,
                lng = pos.coords.longitude,
                latlng = new L.LatLng(lat, lng),

                latAccuracy = 180 * pos.coords.accuracy / 40075017,
                lngAccuracy = latAccuracy / Math.cos(L.LatLng.DEG_TO_RAD * lat),

                bounds = L.latLngBounds(
                        [lat - latAccuracy, lng - lngAccuracy],
                        [lat + latAccuracy, lng + lngAccuracy]),

                options = this._locateOptions;

            if (options.setView) {
                var zoom = Math.min(this.getBoundsZoom(bounds), options.maxZoom);
                this.setView(latlng, zoom);
            }

            var data = {
                latlng: latlng,
                bounds: bounds,
                timestamp: pos.timestamp
            };

            for (var i in pos.coords) {
                if (typeof pos.coords[i] === 'number') {
                    data[i] = pos.coords[i];
                }
            }

            this.fire('locationfound', data);
        }
    });

}(window, document));
// // leaflet-global.js
// define(['leaflet'], function(L) {
//     window.L = L;
//     return L;
// });
//
require(["pat/inject"]);


/* **********************************************
     Begin pattern-mapcontroller.js
********************************************** */

// @codekit-prepend "_includepattern.js""
// jshint indent: 4, browser: true, jquery: true, quotmark: single, camelcase: false, eqnull:true
// vim: sw=4 expandtab
/* global  define,L, require */

/**
 * Patterns mapcontroller - leaflet map controller
 *
 * Map starter for leaflet data
 * @author: Ron Jonk - @onswater
 * @link: http://www.onswater.nl
 * @version: 1.0
 * example html
 * <div id="map1" class="pat-map-leaflet"
        data-pat-leaflet="url: 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png' ;
                          attribution: Kaartgegevens: © <a href='http://www.cbs.nl'>CBS</a>, <a href='http://www.kadaster.nl'>Kadaster</a>, <a href='http://openstreetmap.org'>OpenStreetMap</a>. ;
                          max-zoom: 9;
                          start-zoom: 3;
                          min-zoom: 1;
                          api-key: Fmjtd%7Cluub20uy2q%2Caw%3Do5-9urlq0;
                          alt-text: Waterhoogte aanduiding in nederland;">

        <div class="maplocation" data-location="52.080956570675866, 4.306919574737549">
             <h3>Zuid-Beveland</h3>
            <p>
                Overstromingskans: groter dan 1 op 100 per jaar
            </p>
            <p>
                Verwacht aantal slachtoffers: 10 per jaar
            </p>
            <p>
                Verwachte schade: €38.000.000,- per jaar
            </p>
        </div>
    </div>
 *
 * the name of js must start with'leaflet' the image for the marker must be inside the image folder of the stylesheet
 */
;
define('pat/leaflet',['jquery','../registry','../core/parser'],function($, patterns, Parser) {

    var parser = new Parser('leaflet');

    parser.add_argument('url');
    parser.add_argument('attribution');
    parser.add_argument('max-zoom', 9, [1,2,3,4,5,6,7,8,9]);
    parser.add_argument('start-zoom', 9, [1,2,3,4,5,6,7,8,9]);
    parser.add_argument('min-zoom', 1, [1,2,3,4,5,6,7,8]);
    parser.add_argument('api-key','');
    parser.add_argument('alt-text', 'landkaart');

    //overwrite imagePathFunction to look for path next to csspath not js path
    L.Icon.Default.imagePath = (function() {
        var scripts = document.getElementsByTagName('link'),
            leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.css\??/;

        var i, len, src, matches, path;

        for (i = 0, len = scripts.length; i < len; i++) {
            src = scripts[i].href;
            matches = src.match(leafletRe);

            if (matches) {
                path = src.split(leafletRe)[0];
                return (path ? path + '/' : '') + 'images';
            }
        }
    }());

    var mapLeaflet = {
        name: 'map-leaflet',
        trigger: '.pat-map-leaflet',

        init: function($el, opts) {

            $.leafletController = function(el, options) {
                // To avoid scope issues, use 'controller' instead of 'this'
                // to reference this class from internal events and functions.
                var controller = this;

                // Access to jQuery and DOM versions of element
                controller.$el = $(el);
                controller.el = el;

                // Add a reverse reference to the DOM object referencing like $(".map").data("MapController")
                controller.$el.data('MapController', controller);


                /**
                 * initialise the map, create map, markers en eventhandlers
                 * @return none
                 */
                controller.init = function() {
                    controller.options = $.extend({}, $.leafletController.defaultOptions, options);
                    // data passed as  data attribute in the html has priority above passed by javascript
                    controller.tileProviderUrlTemplate =  controller.options.url.replace("'","");
                    controller.maxZoom = controller.options.maxZoom;
                    controller.startZoom =  controller.options.startZoom;
                    controller.minZoom = controller.options.minZoom;
                    controller.attribution = controller.options.attribution;
                    controller.apiKey = controller.options.apiKey;
                    controller.subDomains = controller.options.subDomains;
                    controller.dataMarkers =  controller.options.dataMarkers;
                    controller.altText = controller.options.altText;

                    // collect the data from json or table
                    controller.markerdata = controller._setData(controller.dataMarkers);
                    // init the map
                    this.map = this._createMap();
                    // add the markers layer
                    this._setMarkers(controller.markerdata.markers, this.map);
                    this.map.whenReady(this._onWhenReady);
                    this.map.on('click', this._onMapClick);
                    this.map.on('focus', this._onMapFocus, this);
                    this.map.on('blur', this._onMapBlur, this);
                };

                /**
                 * init events when map buidling is ready
                 * @return none
                 */
                controller._onWhenReady = function() {
                    //console.log('i\'m ready!!!!');
                    if (controller.options.listenToEvents) {
                        this.on('popupopen', controller._handlePopupOpen);
                        this.on('popupclose', controller._handlePopupClose);
                    }

                    if (options.addAltText){
                        controller._setAltText();
                    }

                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                controller._onMapFocus = function() {
                    controller.$el.addClass('focus');
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                controller._onMapBlur = function() {
                    controller.$el.removeClass('focus');
                };

                /**
                 * Create the leaflet map
                 * @return {map} initialised map with tileLayer
                 */
                controller._createMap = function() {
                    var map = L.map(controller.el.id, {
                        continuousWorld: true,
                        zoom: controller.startZoom,
                        dragging: controller.options.dragging,
                        zoomControl: controller.options.zoomControl,
                        scrollWheelZoom: controller.options.scrollWheelZoom,
                        doubleClickZoom: controller.options.doubleClickZoom,
                        boxZoom: controller.options.boxZoom,
                        touchZoom: controller.options.touchZoom,
                        keyboard: controller.options.keyboardInteraction,
                        trackResize: controller.options.trackResize,
                        layers: [
                                new L.TileLayer(controller.tileProviderUrlTemplate, {
                                    attribution: controller.attribution,
                                    maxZoom: controller.maxZoom,
                                    minZoom: controller.minZoom,
                                    subdomains: controller.subDomains,
                                    key: controller.apiKey,
                                    detectRetina: true,
                                    continuousWorld: true
                                })
                            ]
                        });

                    // L.tileLayer(controller.tileProviderUrlTemplate, {
                    //  attribution: controller.attribution,
                    //  maxZoom: controller.maxZoom,
                    //  minZoom: controller.minZoom,
                    //  subdomains: controller.subDomains,
                    //  key: controller.apiKey,
                    //  detectRetina: true
                    // }).addTo(map);

                    // add scale to map
                    L.control.scale({
                        imperial: false,
                        position:'topright'
                    }).addTo(map);

                    //if(controller.options.zoomControl){
                    //var zoomControl     = new L.Control.Zoom({ position: 'topright'} ); // default topleft
                    //var scaleControl    = new L.Control.Scale({ position: 'bottomleft' });
                    //zoomControl.addTo(map);
                    //scaleControl.addTo(map);
                    //}
                    return map;
                };

                /**
                 * set the markers on the map layer
                 * @param  {[type]} markers pass controller.markerdata.markers
                 * @return none
                 */
                controller._setMarkers = function(markers, map) {
                    //console.log(markers);
                    // {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                    controller.markers = [];
                    controller.bounds = [];
                    // between 200 and 300 maximum width of map 2*19 is margin in popup + 14px side space
                    var popupOptions = {
                        minWidth: Math.min(map._container.offsetWidth, 200) ,
                        maxWidth: Math.min(map._container.offsetWidth-53, 300)
                    };

                    $.each(markers, function(index, mrk) {
                        var title = mrk.title.replace(/(<([^>]+)>)/ig, '').replace(/^\s+|\s+$/g, '');// strip tags and trailing leading whitespace
                        var lmrk = L.marker(mrk.latlng, {
                            title: title
                        }).addTo(map);
                        controller.markers.push(lmrk);
                        controller.bounds.push(mrk.latlng);
                        //controller.markers[index].bindPopup('<h3>' + mrk.title + '</h3>' + mrk.popuptext);

                        controller.markers[index].bindPopup(mrk.popuptext,popupOptions);
                    });

                    //console.log(controller.bounds);
                    var latlngBounds = new L.latLngBounds(controller.bounds);
                    //this.map.fitBounds(latlngBounds, { padding: new L.point(16, 16)});
                    this.map.fitBounds(latlngBounds, {
                        padding: new L.point(16, 16)
                    });

                    //zoom map to certain level
                    //multiple points controller.startZoom or based on fit points
                    //single point controller.startZoom or marker zoom or default
                    if(parseInt(controller.startZoom,10)>-1){
                        this.map.setZoom(controller.startZoom);
                    } else if (markers.length === 1) {
                        this.map.setZoom(markers[0].zoom || controller.options.startZoom);
                    }
                };

                /**
                 * create controller markerdata object from table or json opject
                 * {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                 * @param  {[type]} data [description]
                 * @return markerdata object
                 */
                controller._setData = function(data) {
                    if (!data) {
                        data = {};
                        var $datatable = null;
                        data.markers = [];

                        $datatable =  controller.$el.children();
                        if($datatable.length === 0) {return;}

                        var dataType = $datatable[0].tagName;
                        // hide visually
                        $datatable.addClass('assistive');

                        // add data to markers array
                        var addDataMarkers = function($el,title,popuptext){
                            var loc = $el.data('location').split(',');
                            var zoom = $el.data('zoom')|| controller.startZoom;
                            //[51.5, -0.09], {title: 'London'}
                            var obj = {
                                latlng: loc,
                                title: title,
                                popuptext: popuptext,
                                zoom: zoom
                            };
                            data.markers.push(obj);
                        };

                        switch (dataType) {
                        case 'TABLE':
                            $datatable.find('tbody tr').each(function() {
                                var $this = $(this);
                                var title = $this.find('th').html();
                                var popuptext = $this.find('td').html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'UL':
                            $datatable.find('li').each(function() {
                                var $this = $(this);
                                var title = $this.find('a').html() || $this.html();
                                var popuptext = $this.html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'DIV':
                            // input is selector element with h3, p, img
                            $datatable.each(function() {
                                var $this = $(this);
                                var title = $this.find('h3').html() || $this.find('a').html() || $this.html();
                                var popuptext = $this.html();
                                addDataMarkers($this,title,popuptext);
                            });

                            break;
                        case 'DL':
                            // TODO
                            break;
                        }
                    }
                    return data;
                };

                /**
                 * handle events when popup is opened
                 * @return none
                 */
                controller._handlePopupOpen = function(e) {
                    this.dragging.disable();
                    this.touchZoom.disable();
                    this.scrollWheelZoom.disable();
                    this.doubleClickZoom.disable();
                    this.boxZoom.disable();
                    this.keyboard.disable();

                    // focus on anchor on popup
                    $(e.popup._container).find('.leaflet-popup-content a').first().focus();
                    // on tab go to next when there is a second anchor
                    // setView( <LatLng> center, <Number> zoom, <zoom/pan options> options? ) of current marker
                };

                /**
                 * reset events when popup is closed
                 * @return none
                 */
                controller._handlePopupClose = function() {
                    if (this.options.dragging) {
                        this.dragging.enable();
                    }
                    if (this.options.touchZoom) {
                        this.touchZoom.enable();
                    }
                    if (this.options.scrollWheelZoom) {
                        this.scrollWheelZoom.enable();
                    }
                    if (this.options.doubleClickZoom) {
                        this.doubleClickZoom.enable();
                    }
                    if (this.options.boxZoom) {
                        this.boxZoom.enable();
                    }
                    if (this.options.keyboardInteraction) {
                        this.keyboard.enable();
                    }
                    // focus back to map not to markers
                    //this.focus();
                };

                /* -----------------------------------
                    add alt attribute on only the first image in the map
                   ----------------------------------*/
                controller._setAltText = function(){
                    controller.$el.find('img:not([alt])').attr('alt', '').first().attr('alt', this.altText);
                };

                // /**
                //  * This function puts the flood layer on the map.
                //  */
                // controller._putLayer = function () {
                //  var imgCSS = { opacity: 0.5 };
                //  var overlay = new L.ImageOverlay(this.kmlUrl, this.kmlBounds, imgCSS).addTo(this.map);
                // };

                /**
                * This function clears map from any attached markers.
                */
                controller._clearMap = function () {
                    $.each(controller.markers, function (key, marker) {
                        controller.map.removeLayer(marker);
                    });
                };


                // Run initializer
                controller.init();
            };

            /**
             * set default options
             * @type leafletController object
             */
            $.leafletController.defaultOptions = {
                maxZoom: 18,
                minZoom: 1,
                apiKey: 'Fmjtd%7Cluub20uy2q%2Caw%3Do5-9urlq0',
                subDomains: ['otile1', 'otile2', 'otile3', 'otile4'],
                listenToEvents: false,
                url: 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
                attribution: '&copy;<a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, Map data &copy; <a href="http://www.openstreetmap.org/copyright/" target="_blank">OpenStreetMap</a>',
                startZoom: 12,
                dragging: true,
                zoomControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: false,
                touchZoom: true,
                keyboardInteraction: true,
                trackResize: true,
                altText:'Kaart van Nederland',
                addAltText:false,
                kmlUrl: 'images/map/water_levels.png',
                kmlBounds: [[50.343832, 2.511731],[53.876508, 7.751853]]
            };


            return $el.each(function() {
                var $el = $(this),
                    options = parser.parse($el, opts);
                (new $.leafletController(this, options));
            });
        },
    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
});


;require(['registry', 'pat/inject','pat/leaflet'], function(r){r.init();});
