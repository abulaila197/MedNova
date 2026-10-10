// Lists plain (non-worklet) functions called from code that runs on the UI thread
// (animated styles, gesture callbacks, animation callbacks). On a phone such a call
// crashes the app; on the web preview it silently works, so this check catches it early.
// Run: node scripts/check-worklets.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default ?? traverseMod;
const ROOT = new URL('..', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); }
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && !/\.web\.tsx?$/.test(f)) files.push(p);
  }
})(join(ROOT, 'src'));

const SAFE = new Set(`interpolate interpolateColor withTiming withSpring withRepeat withSequence withDelay withDecay withClamp cancelAnimation
runOnJS runOnUI scheduleOnRN scheduleOnUI measure scrollTo setNativeProps clamp isNaN isFinite parseFloat parseInt Number String Boolean Array Object
Math JSON Date Symbol Error console requestAnimationFrame`.split(/\s+/));
const HOOKS = new Set(['useAnimatedStyle', 'useAnimatedProps', 'useDerivedValue', 'useAnimatedReaction', 'useAnimatedScrollHandler', 'useFrameCallback', 'useAnimatedGestureHandler']);
const ANIM = new Set(['withTiming', 'withSpring', 'withDecay', 'withRepeat']);
const GEST = /^on(Start|Update|End|Begin|Finalize|Change|TouchesDown|TouchesMove|TouchesUp|TouchesCancelled)$/;

const isWorkletFn = (n) => n && /Function/.test(n.type) && n.body?.type === 'BlockStatement' && n.body.directives?.some((d) => d.value.value === 'worklet');
const asts = files.map((f) => [f, parse(readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] })]);

// names of every function marked 'worklet' anywhere (exported helpers included)
const worklets = new Set();
for (const [, ast] of asts)
  traverse(ast, {
    VariableDeclarator(p) {
      const i = p.node.init;
      // Reanimated's Easing helpers (e.g. Easing.bezierFn(...)) return worklets
      const easing = i?.type === 'CallExpression' && i.callee.type === 'MemberExpression' && i.callee.object.name === 'Easing';
      if (p.node.id.type === 'Identifier' && (isWorkletFn(i) || easing)) worklets.add(p.node.id.name);
    },
    FunctionDeclaration(p) { if (p.node.id && isWorkletFn(p.node)) worklets.add(p.node.id.name); },
  });

const chainHasRunOnJS = (node) => {
  for (let n = node; n; n = n.callee?.object ?? n.object) {
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property.name === 'runOnJS' && n.arguments[0]?.value === true) return true;
    if (n.type !== 'CallExpression' && n.type !== 'MemberExpression') break;
  }
  return false;
};

let bad = 0;
for (const [f, ast] of asts) {
  const roots = [];
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      const args = p.node.arguments;
      if (c.type === 'Identifier' && HOOKS.has(c.name)) args.forEach((a, i) => { if (/Function/.test(a.type) && (i === 0 || c.name === 'useAnimatedReaction')) roots.push(p.get(`arguments.${i}`)); });
      if (c.type === 'Identifier' && ANIM.has(c.name)) args.forEach((a, i) => { if (i > 0 && /Function/.test(a.type)) roots.push(p.get(`arguments.${i}`)); });
      if (c.type === 'MemberExpression' && GEST.test(c.property.name ?? '') && /Function/.test(args[0]?.type ?? '') && !chainHasRunOnJS(p.node)) roots.push(p.get('arguments.0'));
    },
    Function(p) { if (isWorkletFn(p.node)) roots.push(p); },
  });
  for (const r of roots)
    r.traverse({
      CallExpression(p) {
        const c = p.node.callee;
        if (c.type !== 'Identifier') return;
        const n = c.name;
        if (SAFE.has(n) || worklets.has(n)) return;
        const b = p.scope.getBinding(n);
        // defined inside this worklet (a nested helper) is fine
        if (b && r.node.start <= b.path.node.start && b.path.node.end <= r.node.end) return;
        // calling a callback passed into a worklet via runOnJS(fn)(...) is already excluded (callee is a call)
        bad++;
        console.log(`${relative(ROOT, f)}:${p.node.loc.start.line}  ${n}()`);
      },
    });
}
console.log(bad ? `\n${bad} call(s) to non-worklet functions on the UI thread` : 'OK: no non-worklet calls on the UI thread');
process.exit(bad ? 1 : 0);
