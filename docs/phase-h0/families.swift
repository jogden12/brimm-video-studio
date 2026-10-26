// For the H0 render test (docs/phase-h0/checklist.md, step 3): lists the font families this Mac's apps can use whose names
// contain the words given, with each member's style, its weight on AppKit's scale (5 is regular, 9 bold) and its PostScript name.
// An Adobe Fonts face that is activated shows here even though no font file of it is in a fonts folder.
// It only reads the list of fonts, and changes nothing.
//
//   swift families.swift sweet
import AppKit

let wanted = CommandLine.arguments.dropFirst().joined(separator: " ").lowercased()
let manager = NSFontManager.shared
var found = false
for family in manager.availableFontFamilies where family.lowercased().contains(wanted) {
    found = true
    print(family)
    for member in manager.availableMembers(ofFontFamily: family) ?? [] {
        let postScript = member.count > 0 ? "\(member[0])" : "?"
        let style = member.count > 1 ? "\(member[1])" : "?"
        let weight = member.count > 2 ? "\(member[2])" : "?"
        print("    \(style), weight \(weight) (\(postScript))")
    }
}
if !found {
    print("No font family on this Mac has \"\(wanted)\" in its name.")
}
