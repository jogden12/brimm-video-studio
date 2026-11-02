// The look an HDR working copy is given (workcopy.js): a mild S-curve on the luma and a little more colour, as the last step of the
// chain, in 8 bits. Jason chose it by eye on 2 November 2026, from Apple's own conversion and two strengths of the look. These tests
// pin what the look is made of: its two strengths, and the one lutyuv filter they make. workcopy.test.js pins where the filter
// stands in the chain, and workcopy-real.test.js what it does to a picture. No test here runs ffmpeg.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HDR_LOOK_COLOUR, HDR_LOOK_CONTRAST, hdrLook } from "../workcopy.js";

/** The options of a lutyuv filter, by name: { y, u, v } as text. */
const optionsOf = (filter) => {
  assert.match(filter, /^lutyuv=/);
  return Object.fromEntries(filter.slice("lutyuv=".length).split(":").map((option) => [option.slice(0, option.indexOf("=")), option.slice(option.indexOf("=") + 1)]));
};
/** What an option makes of a sample `val`. ffmpeg's expressions and JavaScript's share the arithmetic these use, so the text is run as it
    is, with `val`, `sin` and `PI` given. */
const at = (expression, val) => new Function("val", "sin", "PI", `return ${expression};`)(val, Math.sin, Math.PI);

describe("the look of an HDR working copy", () => {
  it("is two strengths, named: 0.3 of an S-curve on the luma and 1.12 times the colour, the mild look Jason chose on 2 November", () => {
    assert.deepEqual([HDR_LOOK_CONTRAST, HDR_LOOK_COLOUR], [0.3, 1.12]);
  });
  it("is made of those strengths when it is given none, and of any it is given", () => {
    assert.equal(hdrLook(), hdrLook(HDR_LOOK_CONTRAST, HDR_LOOK_COLOUR));
    assert.equal(hdrLook(), "lutyuv=y=16+219*(((val-16)/219)-0.3*sin(2*PI*((val-16)/219))/(2*PI)):u=128+(val-128)*1.12:v=128+(val-128)*1.12");
    // The medium look Jason was shown beside it, and did not choose.
    assert.equal(hdrLook(0.45, 1.22), "lutyuv=y=16+219*(((val-16)/219)-0.45*sin(2*PI*((val-16)/219))/(2*PI)):u=128+(val-128)*1.22:v=128+(val-128)*1.22");
  });
  it("is one lutyuv filter of the luma and the two colours and nothing else", () => {
    assert.deepEqual(Object.keys(optionsOf(hdrLook())), ["y", "u", "v"]);
  });
  it("holds no comma and no quote, so that the chain, cut at its commas, has the look for one piece and needs no quoting", () => {
    for (const look of [hdrLook(), hdrLook(0.45, 1.22), hdrLook(0, 1)]) {
      assert.doesNotMatch(look, /[,'"\\]/, look);
      assert.equal(look.split(",").length, 1);
    }
  });
  it("leaves black, white and the middle grey of an 8-bit picture where they are, and spreads what is between: dark darker and light lighter", () => {
    const { y } = optionsOf(hdrLook());
    // 16 is black and 235 white in the limited range an 8-bit picture is in; 125.5 is halfway between them.
    assert.ok(Math.abs(at(y, 16) - 16) < 1e-9, `${at(y, 16)}`);
    assert.ok(Math.abs(at(y, 235) - 235) < 1e-9, `${at(y, 235)}`);
    assert.ok(Math.abs(at(y, 125.5) - 125.5) < 1e-9, `${at(y, 125.5)}`);
    assert.ok(at(y, 60) < 60 && at(y, 90) < 90, "the dark half is not darker");
    assert.ok(at(y, 160) > 160 && at(y, 200) > 200, "the light half is not lighter");
  });
  it("keeps every sample the picture can have inside 0 to 255 without a clip, and never turns the luma back on itself", () => {
    // That is why the filter needs no clip(), whose commas it could not have: ffmpeg clips a value out of range to 0 and 255 anyway,
    // and none a picture of 8 bits can have (any luma, and a colour from 16 to 240) is out of it.
    const { y, u, v } = optionsOf(hdrLook());
    let before = -Infinity;
    for (let val = 0; val <= 255; val++) {
      const luma = at(y, val);
      assert.ok(luma >= 0 && luma <= 255, `the luma of ${val} is ${luma}`);
      assert.ok(luma >= before, `the luma of ${val} is ${luma}, less than the one before`);
      before = luma;
    }
    for (let val = 16; val <= 240; val++) {
      for (const [name, expression] of [["u", u], ["v", v]]) {
        const made = at(expression, val);
        assert.ok(made >= 0 && made <= 255, `${name} of ${val} is ${made}`);
      }
    }
  });
  it("makes a colour 1.12 times as far from the grey as it was, whichever way it leans, and leaves the grey alone", () => {
    const { u, v } = optionsOf(hdrLook());
    for (const expression of [u, v]) {
      assert.equal(at(expression, 128), 128);
      assert.ok(Math.abs(at(expression, 188) - (128 + 60 * 1.12)) < 1e-9);
      assert.ok(Math.abs(at(expression, 68) - (128 - 60 * 1.12)) < 1e-9);
    }
  });
  it("does nothing at no S-curve and the colour times 1: those strengths are the look that changes nothing", () => {
    const { y, u, v } = optionsOf(hdrLook(0, 1));
    for (const val of [16, 17, 100, 128, 200, 235]) {
      assert.ok(Math.abs(at(y, val) - val) < 1e-9, `${val}`);
      assert.equal(at(u, val), val);
      assert.equal(at(v, val), val);
    }
  });
});
