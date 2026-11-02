// The look an HDR working copy is given (workcopy.js): a mild S-curve on the luma and a little more colour, as the last steps of the
// chain, in 8 bits. Jason chose it by eye on 2 November 2026, from Apple's own conversion and two strengths of the look. These tests
// pin what the look is made of: its two strengths, the one lutyuv filter they make, the two limiters that hold what it makes inside
// the legal range, and what is written of it in a copy's facts. workcopy.test.js pins where they stand in the chain, and
// workcopy-real.test.js what they do to a picture. No test here runs ffmpeg.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HDR_LOOK_COLOUR, HDR_LOOK_CONTRAST, HDR_LOOK_LIMITS, hdrLook, hdrLookFacts } from "../workcopy.js";

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
  it("keeps every sample inside 0 to 255, which is all the filter holds it to, and never turns the luma back on itself", () => {
    // The filter has no clip(), whose commas it could not have, and ffmpeg holds what a lut makes to 0 and 255. The legal range is
    // held by the two limiters that follow it (below), as the look Jason chose was measured with a clip().
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

/** What ffmpeg's lut makes of a sample: the result of the expression cut down to a whole number, toward 0, and held to 0 and 255
    (measured on ffmpeg 9.0.2, which is the Mac Studio's). */
const lutOf = (expression, val) => Math.min(255, Math.max(0, Math.trunc(at(expression, val))));
/** A limiter filter's range and planes, read from its text. */
const limitsOf = (limiter) => {
  const read = /^limiter=min=(\d+):max=(\d+):planes=(\d+)$/.exec(limiter);
  assert.ok(read, limiter);
  return { min: Number(read[1]), max: Number(read[2]), planes: Number(read[3]) };
};
const held = ({ min, max }, sample) => Math.min(max, Math.max(min, sample));

describe("the limiters that hold the look inside the legal range of an 8-bit picture", () => {
  const [luma, colours] = HDR_LOOK_LIMITS.map(limitsOf);
  it("are two: the luma held to 16 to 235, and the two colours to 16 to 240, each by the planes it is given (1 is the luma, 6 the colours)", () => {
    assert.equal(HDR_LOOK_LIMITS.length, 2);
    assert.deepEqual([luma, colours], [{ min: 16, max: 235, planes: 1 }, { min: 16, max: 240, planes: 6 }]);
  });
  it("hold no comma and no quote, so that each is one piece of the chain", () => {
    for (const limiter of HDR_LOOK_LIMITS) assert.doesNotMatch(limiter, /[,'"\\]/, limiter);
  });
  it("change no luma that the look keeps from 16 to 235, which is all the luma from 16 to 235, and hold what it makes of the rest", () => {
    const { y } = optionsOf(hdrLook());
    for (let val = 16; val <= 235; val++) {
      const made = lutOf(y, val);
      assert.equal(held(luma, made), made, `the luma of ${val} comes out ${made}`);
    }
    // A black below black comes out of the S-curve as 4, and a white above white as 249: the limiter brings them back.
    assert.equal(lutOf(y, 0), 4);
    assert.equal(lutOf(y, 255), 249);
    for (let val = 0; val <= 255; val++) assert.ok(held(luma, lutOf(y, val)) >= 16 && held(luma, lutOf(y, val)) <= 235, `${val}`);
  });
  it("change no colour that the look keeps from 16 to 240, which is every colour within 99 of the grey, and hold what it makes of the rest", () => {
    const { u, v } = optionsOf(hdrLook());
    for (const expression of [u, v]) {
      let held_ = 0;
      for (let val = 16; val <= 240; val++) {
        const made = lutOf(expression, val);
        if (Math.abs(val - 128) <= 99) assert.equal(held(colours, made), made, `the colour ${val} comes out ${made}`);
        assert.ok(held(colours, made) >= 16 && held(colours, made) <= 240, `${val}`);
        if (held(colours, made) !== made) held_ += 1;
      }
      // The fullest colours the picture can have are made fuller than it can hold: 16 comes out as 2, and 240 as 253.
      assert.equal(lutOf(expression, 16), 2);
      assert.equal(lutOf(expression, 240), 253);
      assert.ok(held_ >= 20, `${held_} colours are held`);
    }
  });
});

describe("what is written of the look in the facts of a copy made with it", () => {
  it("is its name and its two strengths, so that a copy made with the look can be told from one made before it", () => {
    assert.deepEqual(hdrLookFacts(), { name: "mild", contrast: 0.3, colour: 1.12 });
    assert.deepEqual([hdrLookFacts().contrast, hdrLookFacts().colour], [HDR_LOOK_CONTRAST, HDR_LOOK_COLOUR]);
  });
  it("is a new object each time, so that nothing that changes what is written changes what the look is", () => {
    assert.notEqual(hdrLookFacts(), hdrLookFacts());
    hdrLookFacts().contrast = 9;
    assert.equal(hdrLookFacts().contrast, 0.3);
  });
});
