var config = require('config');
var fs = require('fs');
var he = require('he');
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
        config.addDefaultConfig(path.join(__dirname, 'config/locale.js'));
        this._paramName = config.locale.paramName;
        this._defaultLocale = config.locale.default;
        this._localeDefaults = config.locale.localeDefaults;
        this._locale = this._defaultLocale;
        this._paths = process.env.NODE_LANG_DIR || config.locale.paths;
        this._paths = Array.isArray(this._paths) ? this._paths : [this._paths];
        this._cached = {};
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
                req.locale = this._locale;
            } catch (e) {
                req.locale = this._locale = this._defaultLocale;
                return this.errorHandler(req, res, e, next);
            }
            next();
        };
    }

    /**
     * Will process a given string and replace all occurrences of placeholders in the format
     * of R.token.
     * @param {string} contents     Any String with placeholders
     * @param {string} locale       Either the short or long form of a locale (e.g. en-US)
     * @param {string} [identifier] When given a unique identifier the module will cache a conversion
     * @param {boolean} [force]     When using an identifier this will force a refresh
     * @returns {string}    The converted data
     */
    process(contents, locale, identifier, force) {
        locale = this._getLocale(locale);
        if (!force && this._cached[identifier] && this._cached[identifier][locale]) {
            return this._cached[identifier];
        }
        let prefix = 'R.';
        let stopCond = /[^\.\w_\-]/;
        let result = '';
        let copied = 0;
        var i = contents.indexOf(prefix);
        while ((i !== -1)) {
            var endMatch, length, token, key;
            var tail = contents.substr(i);
            endMatch = tail.match(stopCond);
            length = endMatch == null ? tail.length : length = endMatch.index + endMatch[0].length - 1;
            token = tail.substr(0, length);
            key = token.substr(prefix.length);
            var next = contents.indexOf(prefix, i + length + 1);

            result += contents.substring(copied, i);
            if (this._dictionaries[locale][key] !== undefined) {
                result += he.encode(this._dictionaries[locale][key], {useNamedReferences: true});
            }
            result += contents.substring(i + length, next == -1 ? contents.length : next);
            i = copied = next;
        }
        this._cached[identifier] = this._cached[identifier] || {}
        this._cached[identifier][locale] = result;
        return result;
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
     * Will resort to using the only the first section of a locale if an exact match couldn't be found.
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
        locale = locale.substr(0, 2);
        let localeDefault = this._localeDefaults[locale];
        if (localeDefault && this._dictionaries[localeDefault]) {
            return localeDefault;
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
        if (this._paths.indexOf(dir) !== -1) {
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