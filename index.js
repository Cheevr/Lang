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
        this._paramName = config.locale.paramName;
        this.reload();
    }

    /**
     * Returns a middleware function that will set the locale based on incoming requests.
     * @returns {function} The middleware function
     */
    middleware() {
        return (req, res, next) => {
            this._locale = config.locale.default;
            if (req.headers['accept-language']) {
                let langs = req.headers['accept-language'].split(',');
                langs = langs.map(lang => {
                    let langParts = lang.split(';');
                    return {
                        code: langParts[0],
                        priority: langParts[1] && parseInt(langParts[1]) || 1
                    }
                });
                langs.sort((a, b) => {
                    return a.priority - b.priority;
                });
                for (let lang of langs) {
                    let locale = this._getLocale(lang.code);
                    if (locale) {
                        this._locale = locale;
                        break;
                    }
                }
            }
            for (let method of ['params', 'query', 'session', 'cookie', 'body']) {
                let candidate = req[method] && req[method][this._paramName];
                if (candidate) {
                    this._locale = this._getLocale(candidate) || this._locale;
                }
            }
            next();
        };
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
        let dir = process.env.NODE_LANG_DIR || path.join(cwd, config.paths.lang);
        let files = fs.readdirSync(dir);
        for (let file of files) {
            let ext = path.extname(file);
            let name = path.basename(file, ext);
            if (ext == '.js' || ext == '.json') {
                this._dictionaries[name] = require(path.join(dir, file));
            }
        }
        if (!this._dictionaries[config.locale.default]) {
            throw new Error('The language module has been loaded without a default language!');
        }
    }
}

module.exports = new Lang();