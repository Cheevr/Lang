var config = require('config');
var fs = require('fs');
var path = require('path');


const cwd = path.dirname(require.main.filename);
const isoRegExp = /^[a-z]{2}(-[A-Z]{2})?$/;

/**
 * A helper function that will allow jade and javascript to use placeholder in a string (such as {0} and {1}).
 * @returns {string}
 */
String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{\{|}}|\{(\d+)}/g, function (m, n) {
        if (m == "{{") {
            return "{";
        }
        if (m == "}}") {
            return "}";
        }
        return args[n];
    });
};

class Lang {
    constructor() {
        this._paramName = config.locale && config.locale.paramName || 'lang';
        this._defaultLocale = config.locale && config.locale.default || 'en-US';
        this._locale = this._defaultLocale;
        this._paths = config.paths && config.paths.lang || process.env.NODE_LANG_DIR || 'lang';
        this._paths = Array.isArray(this._paths) ? this._paths : [this._paths];
        this.reload();
    }

    /**
     * Returns a middleware function that will set the locale based on incoming requests.
     * @returns {function} The middleware function
     */
    middleware() {
        return (req, res, next) => {
            this._locale = this._defaultLocale;
            try {
                if (req.headers['accept-language']) {
                    let langs = req.headers['accept-language'].split(',');
                    langs = langs.map(lang => {
                        let langParts = lang.trim().split(';');
                        return {
                            code: langParts[0].trim(),
                            priority: langParts[1] && parseInt(langParts[1]) || 1
                        }
                    });
                    langs.sort((a, b) => {
                        return a.priority - b.priority;
                    });
                    for (let lang of langs) {
                        let locale = this._getLocale(lang.code);
                        if (locale) {
                            this.locale = locale;
                            break;
                        }
                    }
                }
                for (let method of ['params', 'query', 'session', 'cookie', 'body']) {
                    let candidate = req[method] && req[method][this._paramName];
                    if (candidate) {
                        this.locale = candidate;
                    }
                }
            } catch (e) {
                this._locale = this._defaultLocale;
                return this.errorHandler(req, res, e, next);
            }
            next();
        };
    }

    /**
     * An error handler for the middleware, that can be overridden with custom functionality.
     * Default behavior is to terminate here with a 403 status code.
     * @param {ClientRequest} req   Request object from the web server
     * @param {ServerResponse} res  Response object from the web server
     * @param {Error} e             Error thrown during middleware evaluation
     * @param {function} next       Function chain, that allows to continue execution if desired.
     */
    errorHandler(req, res, e, next) {
        res.status(403).end('Invalid locale format');
    }

    /**
     * A helper function that checks whether a language file has been found for a given locale.
     * @param {string} locale The language to check in ISO format (e.g. en or en-US)
     * @returns {string|boolean} The full available locale (e.g. en-US) or false if it doesn't exist.
     */
    _getLocale(locale) {
        if (!isoRegExp.test(locale)) {
            throw new Error('The given locale is not in a supported format');
        }
        if (this._dictionaries[locale]) {
            return locale;
        }
        for (let available in this._dictionaries) {
            if (available.startsWith(locale)) {
                return available;
            }
        }
        return false;
    }

    /**
     * Sets the locale for the dictionary to be used for look up. Note that this will be
     * overridden with the next middleware call if you make use of that function.
     * @param {string} locale   Either the short or long form of ISO locale (e.g. en or en-US)
     */
    set locale(locale) {
        this._locale = this._getLocale(locale) || this._locale;
    }

    /**
     * Returns the locale the dictionary is currently set to.
     * @returns {string}
     */
    get locale() {
        return this._locale;
    }

    /**
     * Returns the dictionary for the currently set locale.
     * @returns {*}
     */
    get dictionary() {
        return this._dictionaries[this._locale];
    }

    /**
     * Reloads the language files from disk.
     */
    reload() {
        this._dictionaries = {};
        for (let path of this._paths) {
            this._load(path);
        }
        if (!this._dictionaries[this._defaultLocale]) {
            throw new Error('The language module has been loaded without a default language!');
        }
    }

    /**
     * Adds a directory from which to load configuration from. This allows libraries
     * that have their own translation files to set a directory for them without requiring
     * the config object. Note that if a directory has been scanned before it will not be
     * scanned again, unless reload is called which will include the previously added
     * directories.
     * @param {string} dir  The directory from which to load the scripts from
     */
    addDirectory(dir) {
        if (path.isAbsolute(dir)) {
            dir = path.relative(cwd, dir);
        }
        if (this._paths.indexOf(dir)) {
            return;
        }
        this._paths.push(dir);
        this._load(dir);
    }

    _load(langPath) {
        let dir = process.env.NODE_LANG_DIR || path.join(cwd, langPath);
        let files = fs.readdirSync(dir);
        for (let file of files) {
            let parts = file.split('.');
            if (parts.length == 2) {
                parts.unshift('default');
            }
            if (parts.length != 3) {
                throw new Error('An invalid language file has been detected:' + file);
            }
            let ext = parts[2];
            let name = parts[1];
            let section = parts[0];
            if (ext == 'js' || ext == 'json') {
                let data = require(path.join(dir, file));
                this._dictionaries[name] = this._dictionaries[name] || {};
                if (section == 'default') {
                    Object.assign(this._dictionaries[name], data);
                } else {
                    this._dictionaries[name][section] = this._dictionaries[name][section] || {};
                    Object.assign(this._dictionaries[name][section], data);
                }
            }
        }
    }
}

module.exports = new Lang();