/**
 * @typedef {Object} kuromoji
 * @description The main namespace object for the Kuromoji library.
 */

/**
 * Initializes the tokenizer.
 * @returns {Promise<Tokenizer>} - The tokenizer instance.
 */
function initializeTokenizer() {
    return new Promise((resolve, reject) => {
        /**
         * @typedef {Object} KuromojiBuilder
         * @property {string} dicPath - The path to the dictionary files.
         * @property {function(callback: function(Error, Tokenizer)): void} build - Builds the tokenizer asynchronously.
         */

        /**
         * Builds a Kuromoji tokenizer with the specified options.
         *
         * @function
         * @name kuromoji.builder
         * @param {Object} options - The builder options.
         * @param {string} options.dicPath - The path to the dictionary files.
         * @returns {KuromojiBuilder} - The Kuromoji builder object.
         */
        kuromoji.builder({dicPath: 'dict'}).build((err, tokenizer) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(tokenizer);
        });
    });
}