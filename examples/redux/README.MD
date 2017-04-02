# redux example

simple example but allow to manually check a lot of things

1. create two different subscribing combinators which will subscribe to the changes of two different slices of the state. And will be able to trigger different actions although the method names can be the same !
2. so we can create a generic component to pass to the above combinators using different mapStateSliceToProp function.
3. We can actually create multiple instance of the same component (ie two "Counter1")
4. We create another component which we will pass to one of the above combinator (so the component itself does not really matter !!! combinator power ++)
5. We add some attribute whose value will depend on the state.