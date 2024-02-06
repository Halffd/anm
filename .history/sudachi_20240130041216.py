from flask import Flask, request, jsonify, render_template
from sudachipy import Dictionary
from pykakasi import kakasi
from flask_cors import CORS
import jaconv
import re


class CustomFlask(Flask):
    jinja_options = Flask.jinja_options.copy()
    jinja_options.update(
        dict(
            variable_start_string="%%",  # Default is '{{', I'm changing this because Vue.js uses '{{' / '}}'
            variable_end_string="%%",
        )
    )


app = Flask(__name__, template_folder="../animebook.github.io")
CORS(app, resources={r"/*": {"origins": "*"}})
dictionary = Dictionary().create()
tokenizer = dictionary
mod = "A"


def modes(input_string):
    global mod
    mode_mapping = {
        "a": tokenizer.SplitMode.A,
        "b": tokenizer.SplitMode.B,
        "c": tokenizer.SplitMode.C,
    }

    mode = mode_mapping.get(input_string.lower())
    mod = mode
    return mode


def convert_to_romaji(text):
    kakasi_inst = kakasi()
    kakasi_inst.setMode("H", "a")
    kakasi_inst.setMode("K", "a")
    kakasi_inst.setMode("J", "a")
    conv = kakasi_inst.getConverter()
    return conv.do(text)


def get_token_frequency(text):
    token_frequency = {}
    return token_frequency


@app.route("/")
def index():
    # parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
    # template_path = os.path.join(parent_dir, 'anm', "index.html")
    return render_template("index.html")  # template_path)


@app.route("/analyze", methods=["POST"])
def analyze_text():
    text = request.json["text"]
    mode = modes(request.json.get("mode", "A"))
    nominal_form = request.json.get("nominal_form", False)
    print_fields = request.json.get("print_fields", False)

    tokens = tokenizer.tokenize(text, mode)

    analysis = []
    for token in tokens:
        analysis.append(token_to_dict(token, nominal_form, print_fields))
    return jsonify(analysis)


@app.route("/furigana", methods=["POST"])
def analyze_furigana():
    print(request.json)
    text = request.json["text"]
    mode = modes(request.json.get("mode", "A"))
    tokens = tokenizer.tokenize(text, mode)

    furigana = []
    for token in tokens:
        furigana.append(token_to_dict(token, furi=True))

    return jsonify(furigana)


@app.route("/furiganas", methods=["POST"])
def analyze_furiganas():
    print(request.json)
    texts = request.json["text"]
    f = []
    for text in texts:
        mode = modes(request.json.get("mode", "A"))
        tokens = tokenizer.tokenize(text, mode)

        furigana = []
        for token in tokens:
            e = token_to_dict(token, furi=True, short=True)
            if e is not None:
                furigana.append(e)
        f.append(furigana)

    return jsonify(f)


@app.route("/romaji", methods=["POST"])
def analyze_romaji():
    text = request.json["text"]
    mode = modes(request.json.get("mode", "A"))
    tokens = tokenizer.tokenize(text, mode)

    romaji = []
    for token in tokens:
        romaji.append(token_to_dict(token, romaji=True))

    return jsonify(romaji)


@app.route("/grammar", methods=["POST"])
def analyze_grammar():
    text = request.json["text"]
    mode = modes(request.json.get("mode", "A"))
    tokens = tokenizer.tokenize(text, mode)

    grammar = []
    for token in tokens:
        grammar.append(token_to_dict(token, grammar=True))

    return jsonify(grammar)


@app.route("/frequency", methods=["POST"])
def analyze_frequency():
    text = request.json["text"]
    mode = modes(request.json.get("mode", "A"))
    tokens = tokenizer.tokenize(text, mode)

    frequency = []
    for token in tokens:
        frequency.append(token_to_dict(token, frequency=True))

    return jsonify(frequency)


def token_to_dict(
    token,
    nominal_form=False,
    romaji=False,
    grammar=False,
    frequency=False,
    dicts=False,
    furi=False,
    short=False
):
    global mod
    if nominal_form or grammar:
        return token.normalized_form()
    hiragana_reading = jaconv.kata2hira(token.reading_form())
    roma = convert_to_romaji(token.reading_form())
    token_dict = {
        "surface": token.surface(),
        "part_of_speech": token.part_of_speech(),
        "katakana": token.reading_form(),
        "reading": hiragana_reading,
        "dictionary_form": token.normalized_form(),
        "read": "",
        "romaji": roma,
    }
    print(token_dict)

    if nominal_form and token.part_of_speech()[0] == "名詞":
        token_dict["nominal_form"] = token.normalized_form()

    if grammar:
        token_dict["conjugation_form"] = __name__

    if frequency:
        token_dict["frequency"] = [
            token.word_id(),
            token.synonym_group_ids(),
            token.raw_surface(),
        ]
    if not dicts:
        tks = tokenizer.tokenize(token.normalized_form(), mod)
        t = token_to_dict(tks[0], dicts=True)
        if furi:
            kanji_pattern = re.compile(r'[\u4e00-\u9faf]')
            kanji_matches = kanji_pattern.findall(token.normalized_form())
            if not kanji_matches:
                fg = None
            elif short:
                fg = [token.normalized_form(), hiragana_reading]
            else:
                fg = [token.normalized_form(), hiragana_reading, t["reading"]]
            return fg
        token_dict["read"] = t["reading"]
        token_dict["token"] = t
        token_dict["romaji"] = [roma, t["romaji"]]
        if romaji:
            return [
                token.normalized_form(),
                token_dict["romaji"][0],
                token_dict["romaji"][1],
                hiragana_reading,
                t["reading"],
            ]
        return token_dict

    return token_dict


if __name__ == "__main__":
    app.run(debug=True)
