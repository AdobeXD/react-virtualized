

Adobe Plugin Toolkit optimized fork of react-virtualized
---------------

This fork contains fixes and tuning to enhance performance on UXP based platforms.

## Migration to this fork from react-virtualized

This fork is completely API compatible with the main repository of [react-virtualized](https://github.com/bvaughn/react-virtualized)

Just follow these steps

- run ```yarn remove react-virtualized```
- run ```yarn add @adobe/react-virtualized```
- change your require("react-virtualized") expressions to require("@adobe/react-virtualized")
- make sure you use the "key" parameter provided to your rowRenderer function for each row

## Changes

### Mac and iOS not rendering top rows during scroll bounce.

When scrolling up quickly to the top of a list on a platform with bounce sometimes the top rows would not render for a few seconds while the bounce animation completed.

We fixed the problem by treating negative scroll values the same as zero when rendering.

### Performance optimization to reuse row elements

This changes the key generating algorithm to reuse keys in a rotating fashion in order to minimize expensive createElement calls when new rows come into the viewport. It also keeps the rows in the same initial document order to avoid unnecessary reordering of elements.

NOTE: Reusing elements will cause transient state like focus or input field values not controlled by react state to persist and appear in different rows. If your rows contain focusable input fields then you will want to use your own key values for each list item instead of the rotating keys provided by this fork.
