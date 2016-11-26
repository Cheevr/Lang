/* globals describe, it, after, afterEach, before, beforeEach */

var expect = require('chai').expect;
var express = require('express');
var path = require('path');
var request = require('supertest');

process.env.NODE_LANG_DIR = path.join(__dirname, 'lang');
var lang = require('..');

describe('Lang', () => {
    it ('should parse the default english locale', () => {
        expect(lang.locale).to.equal('en-US');
        expect(lang.dictionary.val1).to.equal('val1');
    });

    it('should combine all of the same locale files into one', () => {
        expect(lang.locale).to.equal('en-US');
        expect(lang.dictionary.val1).to.equal('val1');
        expect(lang.dictionary.val2).to.equal('val2');
        expect(lang.dictionary.section.type).to.equal('subsection');
    });

    it('should set the default language using the middleware', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        lang.locale = 'no-NO';
        request(app).get('/').expect(200, 'en-US').end(done);
    });

    it('should set the language based on a parameter using the middleware', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        request(app).get('/?lang=de-DE').expect(200, 'de-DE').end(done);
    });

    it('should set the language based on a header using the middleware', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        request(app).get('/').set('accept-language', 'de, en-gb;q=0.8, en;q=0.7').expect(200, 'de-DE').end(done);
    });

    it('should fall back to default if a locale doesn\'t exist', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        request(app).get('/?lang=no-NO').expect(200, 'en-US').end(done);
    });

    it('should fall back to a default for a specific locale group if it doesn\'t exist', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        request(app).get('/?lang=en-GB').expect(200, 'en-US').end(done);
    });

    it('should respond with an error if a locale is malformatted', done => {
        var app = express();
        app.use(lang.middleware());
        app.get('/', (req, res) => res.end(lang.locale));
        request(app).get('/?lang=en_US').expect(403, 'Invalid locale format').end(done);
    });

    it('should add a "format" function to all strings', () => {
        expect('This is a {0}'.format('test')).to.equal('This is a test');
    });

    it('should process a string and translate all placeholders', () => {
        let result = lang.process('Going to be R.action with a placeholder', 'en-US');
        expect(result).to.equal('Going to be replaced with a placeholder');
    });

    it('should support multi level placeholder', () => {
        let result = lang.process('Going to be R.nested.action with a placeholder', 'en-US');
        expect(result).to.equal('Going to be improved with a placeholder');
    });

    it('should return an string without any tokens as is', () => {
        let result = lang.process('No placeholders here', 'en-US');
        expect(result).to.equal('No placeholders here');
    });
});