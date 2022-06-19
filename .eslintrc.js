module.exports = {
	'env': {
		'browser': true,
		'es6': true
	},

	'extends': 'eslint:recommended',
	'parserOptions': {
		'ecmaVersion': 2020,
		'sourceType': 'module',
		'ecmaFeatures': {
			'impliedStrict': true,
		}
	},

	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],

		'array-bracket-spacing': ['error', 'never'],
	
		'block-spacing': ['error', 'always'],
		'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
	
		'comma-dangle': ['error', 'always-multiline'],
		'comma-spacing': ['error', { "before": false, "after": true }],
		'new-parens': 'error',
		'no-trailing-spaces': 'error',
		'no-multiple-empty-lines': 'error',
		'space-in-parens': 'error',
		'space-before-function-paren': 'error',
		'space-before-blocks': 'error',
	
		'arrow-body-style': ["error", "always"],
		'arrow-parens': 'error',
		'arrow-spacing': 'error',
		'prefer-arrow-callback': 'error',
		'prefer-const': 'error',
		'no-loop-func': 'error',
		'no-var': 'error',
		
	}
};