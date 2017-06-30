# Lang
[![npm version](https://badge.fury.io/js/%40cheevr%2Flang.svg)](https://badge.fury.io/js/%40cheevr%2Flang)
[![Build Status](https://travis-ci.org/Cheevr/Lang.svg?branch=master)](https://travis-ci.org/Cheevr/Lang)
[![Coverage Status](https://coveralls.io/repos/Cheevr/Lang/badge.svg?branch=master&service=github)](https://coveralls.io/github/Cheevr/Lang?branch=master)
[![Dependency Status](https://david-dm.org/Cheevr/Lang.svg)](https://david-dm.org/Cheevr/Lang)


## About

This module is deigned to make multiple language versions of text strings available in an easy
to maintain way. Language files for multiple versions are kept in various formats on disk and
can be selected by setting the right locale. The library includes helpers to mak eit easy to
use with systems such as express.


## Installation

Use the standard installation method:

```Shell
node i @cheevr/lang
```


## Simple Example

There are multiple ways you can use the library the simplest example does not require any servers
to be used.

To get started create a file named ```lang/en-US.json```:

```JSON
{
    "Greeting": "Hello",
    "Person": "World"
}
```

To make use of your language strings you simple:

```JavaScript
const lang = require('@cheevr/lang');
const example = '{Greeting}, {Person}!';

console.log(lang.process(example, 'en-US');
// Prints "Hello, World!"
```

You can now create additional file matching the locale that you want to support. The library supports
both **.json** and **.js** files as your source.


## Express Example

There are multiple functions written specifically for express and handling http requests. Assuming
You've set up the same language files as in the simple example:

```JavaScript
const lang = require('@cheevr/lang');
const express = require('express');

const app = express();
app.use(lang.middleware());
```

The library will now look for headers and parameters that specify the language. The header values
can be overridden and the parameter name is configurable. By default the library will look for a
parameter named lang in GET, query, session, cookie and POST data (in that order) for overrides
of the header values.

Once the language has been parsed all subsequent method calls will default to using that locale and
the request object will have a local property you can use to see the detected language.

You can now go ahead and process files with that information:

```JavaScript
app.get('/test', (req, res) => res.send(lang.process(example, req.locale)));
```

Assuming you want to render a jade template this is the setup:

```JavaScript
// Use the dictionary while rendering a jade template
app.get('/jade', (req, res) => res.render('index', { dict: lang.dictionary }) );
```

A jade file could now look like this and should fill in the right translations based on the
request parameters:

```Jade
html
    body
        div #{dict.Greeting}, #{dict.Person}!
```

Caution is advised though if you use asynchronous operations between the middleware call and accessing
the dictionary since other requests might have changed the locale in between. If you experience issues
you can force the right language like this:

```JavaScript
app.get('/jade', (req, res) => {
    lang.locale = req.locale;
    res.render('index', { dict: lang.dictionary })
});
```


## API

This is a list of all the methods and properties available through the library. Note that
some functionality is accessible through a file configuration using
[@cheevr/config](https://github.com/cheevr/config).

### Lang.middleware()
This method will return a middleware handler that will look for language information on the
incoming request. The standard header called **accept-language** is what the default source is
but the middleware allows to override the detecting language by providing an extra (configurable)
lang parameter. The parameter is looked for in GET, query, session, cookie and POST data in that
order.

The language format follows standard locale definitions and supports both short form (```en```) and
long form (```en-US```), as well as language priorities (```en-US;q=0.8``` or ```en;q=0.7```).

#### Request.locale

Once a locale has been detected the identified matching result can be accessed on all subsequent
request objects.

### Lang.process({string} source, {string} locale, {string} [id], {bool} [force])




### Lang.errorHandler({ClientRequest} req, {ServerResponse} res, {Error} e, {function} next)




### Lang.locale {string}




### Lang.dictionary {Map<string,*>}




### Lang.reload()




### Lang.extend({string} dir, {string} ...paths)



## Configuration

The lang library makes use of [@cheevr/config](https://github.com/cheevr/config) to define
its behaviour. To change the settings create a lang section in your configuration files. An
example would be in **config/default.json**:

```JSON
{
    "lang": {
        "paramName":"locale"
    }
}
```

Here's a list of options and what they do:

### paramName {string} = "lang"

This option allows you to configure the parameter the middleware will look for when overriding
the locale detected via the _accept-language_ header

### default {string} = "en-US"

When no language can be detected or a requested language is not available the library will
fall back to a default language. If you want to use something different than en-US you can
specify that here.

### paths {string[]} = ["lang"]

Language files are by default placed in the lang folder of the root directory of the project
Should you want to specify one or more different directories you can do it with this option.
Relative paths are always in reference to **cwd**, but absolute paths are also supported if
you want to force a certain directory.

### localeDefaults {Map<string,string>} = { en: 'en-US', de: 'de-DE', ... }

Since locales consist of 2 components and both aren't always available there need to be a
mapping from simple to full locale specification. This map will tell the library how to map
the short forms to actual languages.
Note that right now now no all variations have been mapped so you might want to set your own
mapping if it hasn't been included here yet.


## Future Features for Consideration

* Support for YAML, CSV, XML, ...
* Configurable placeholders (instead of ```{}```)
* Make the interface for forcing a dictionary language more intuitive
  potentially adding a reference to the dictionary on the req object

