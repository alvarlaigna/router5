var router = null;

var listeners = {
    global: function (newState, oldState) {
        return;
    },
    node: function nodeListener(newState, oldState) {
        // Do nothing
    },
    transition: function (fromState, toState, done) {
        done(null);
    },
    transitionErr: function (fromState, toState, done) {
        done(true);
    },
    noop: function () {}
};

var base = window.location.pathname;

var hashPrefix = '!';

function getExpectedPath(useHash, path) {
    return useHash ? '#' + hashPrefix + path : path;
}

function getPath(useHash) {
    if (useHash) return window.location.hash + window.location.search;
    return window.location.pathname.replace(new RegExp('^' + base), '') + window.location.search;
}

describe('router5', function () {
    // Without hash
    testRouter(false);

    // With hash
    testRouter(true);
});

function testRouter(useHash) {
    var router;

    beforeAll(function () {
        router = createRouter(base, useHash, hashPrefix)
    });

    afterAll(function () {
        router.stop();
        window.history.replaceState({}, '', base);
    });

    describe(useHash ? 'with using URL hash part' : 'without using URL hash part', function () {
        it('should throw an error if Router5 is not used as a constructor', function () {
            expect(function () { Router5([]); }).toThrow();
        });

        it('should expose RouteNode path building function', function () {
            expect(router.buildPath('users.list')).toBe('/users/list');
        });

        it('should start with the default route', function (done) {
            expect(getPath(useHash)).toBe('');
            expect(router.getState()).toEqual(null)
            expect(router.isActive('home')).toEqual(false)

            router.start(function () {
                expect(router.started).toBe(true);
                expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/home'));
                expect(router.getState()).toEqual({name: 'home', params: {}, path: '/home'});
                done();
            });
        });

        it('should give an error if trying to start when already started', function (done) {
            router.start(function (err) {
                expect(err).toBe(Router5.ERR.ROUTER_ALREADY_STARTED);
                done();
            });
        });

        it('should start with the start route if matched', function (done) {
            router.stop();
            window.history.replaceState({}, '', base + getExpectedPath(useHash, '/users/view/123'));
            router.start(function (err, state) {
                expect(state).toEqual({name: 'users.view', params: {id: '123'}, path: '/users/view/123'});
                done();
            });
        });

        it('should start with the default route if start route is not matched', function (done) {
            router.stop();
            router.lastKnownState = null;
            router.lastStateAttempt = null;
            window.history.replaceState({}, '', base + getExpectedPath(useHash, '/about'));
            router.start(function () {
                expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/home'));
                done();
            });
        });

        it('should start with the default route if navigation to start route is not allowed', function (done) {
            router.stop();
            window.history.replaceState({}, '', base + getExpectedPath(useHash, '/admin'));
            router.start(function (err) {
                expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/home'));
                done();
            });
        });

        it('should start with an error if navigation to start route is not allowed and no default route is specified', function (done) {
            router.stop();
            router.setOption('defaultRoute', null);
            window.history.replaceState({}, '', base + getExpectedPath(useHash, '/admin'));
            router.start(function (err) {
                expect(err).toBe(Router5.ERR.CANNOT_ACTIVATE)
                done();
            });
        });

        it('should start with no error if no matched start state and no default route', function (done) {
            router.stop();
            router.setOption('defaultRoute', null);
            window.history.replaceState({}, '', base + getExpectedPath(useHash, ''));
            router.start(function (err) {
                expect(err).toBe(null)
                done();
            });
        });

        it('should start with the provided state', function (done) {
            router.stop();
            window.history.replaceState({}, '', base + getExpectedPath(useHash, '/home'));
            spyOn(listeners, 'global').and.callThrough();
            router.addListener('', listeners.global);
            var homeState = {name: 'home', params: {}, path: '/home'};
            router.start(homeState, function (err, state) {
                expect(state).toEqual(homeState);
                expect(router.lastKnownState).toEqual(homeState);
                expect(listeners.global).not.toHaveBeenCalled();
                router.removeListener('', listeners.global);
                done();
            });
        });

        it('should throw an error if default route access is not found', function () {
            router.stop();
            router.setOption('defaultRoute', 'fake.route');
            window.history.replaceState({}, '', base);

            expect(function () {
                router.start();
            }).toThrow();
        });

        it('should call root node listener on first transition', function (done) {
            router.stop();
            router.setOption('defaultRoute', 'home');
            window.history.replaceState({}, '', base);
            spyOn(listeners, 'global').and.callThrough();
            spyOn(listeners, 'noop').and.callThrough();
            router.addNodeListener('', listeners.global);
            router.onTransitionStart(listeners.noop);

            router.start(function (err, state) {
                expect(state).toEqual({name: 'home', path: '/home', params: {}});
                expect(listeners.global).toHaveBeenCalled();
                expect(listeners.noop).toHaveBeenCalled();
                router.offTransitionStart(listeners.noop);
                expect(router._cbs['$start'].length).toBe(0);
                done();
            });
        });

        it('should be able to navigate to routes', function (done) {
            router.navigate('users.view', {id: 123}, {}, function (err) {
                expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/users/view/123'));
                done();
            });
        });

        it('should throw an error if trying to navigate to an unknown route', function () {
            expect(function () { router.navigate('fake.route'); }).toThrow();
        });

        it('should invoke listeners on navigation', function (done) {
            // Removing a listener not added should not throw an error
            router.removeListener(listeners.global);

            router.navigate('home', {}, {}, function () {
                var previousState = router.lastKnownState;
                spyOn(listeners, 'global').and.callThrough();
                router.addListener(listeners.global);

                router.navigate('orders.pending', {}, {}, function () {
                    expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/orders/pending'));
                    expect(listeners.global).toHaveBeenCalledWith(router.lastKnownState, previousState);
                    router.removeListener(listeners.global);
                    done();
                });
            });
        });

        it('should invoke listeners on navigation to same state if reload is set to true', function (done) {
            spyOn(listeners, 'global').and.callThrough();
            router.addListener(listeners.global);

            router.navigate('orders.pending', {}, {}, function () {
                expect(listeners.global).not.toHaveBeenCalled();

                router.navigate('orders.pending', {}, {reload: true}, function () {
                    expect(listeners.global).toHaveBeenCalled();
                    done();
                });
            });
        });

        it('should handle popstate events', function (done) {
            var homeState = {name: 'home', params: {}, path: '/home'};
            var evt = {};
            router.onPopState(evt);
            setTimeout(function () {
                expect(router.getState()).not.toEqual(homeState);

                evt.state = homeState;
                router.onPopState(evt);

                setTimeout(function () {
                    expect(router.getState()).toEqual(homeState);

                    router.navigate('users', {}, {}, function () {
                        router.registerComponent('users', {canDeactivate: function () { return false; }});
                        // Nothing will happen
                        router.onPopState(evt);
                        // Push to queue
                        setTimeout(function () {
                            expect(router.getState()).not.toEqual(homeState);
                            router.deregisterComponent('users');
                            done();
                        });
                    });
                });
            });
        });

        it('should be able to remove listeners', function (done) {
            router.removeListener(listeners.global);
            spyOn(listeners, 'global').and.callThrough();

            router.navigate('orders.view', {id: 123}, {replace: true}, function () {
                expect(listeners.global).not.toHaveBeenCalled();
                done();
            });
        });

        it('should not invoke listeners if trying to navigate to the current route', function (done) {
            spyOn(listeners, 'global').and.callThrough();
            router.addListener(listeners.global);

            router.navigate('orders.view', {id: 123}, {}, function () {
                expect(listeners.global).not.toHaveBeenCalled();
                router.removeListener(listeners.global);
                done();
            });
        });

        it('should be able to stop routing', function (done) {
            router.navigate('orders.pending', {}, {}, function () {
                router.stop();
                expect(router.started).toBe(false);
                router.navigate('users.list', {}, {}, function () {
                    expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/orders/pending'));
                    // Stopping again shouldn't throw an error
                    router.stop();
                    done();
                });
            });
        });

        it('should not start with default route if current path matches an existing route', function (done) {
            router.start(function () {
                expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/orders/pending'));
                done();
            });
        });

        it('should invoke node listeners', function (done) {
            router.navigate('users.list', {}, {}, function () {
                spyOn(listeners, 'node').and.callThrough();
                router.addNodeListener('users', listeners.node);
                router.navigate('users.view', {id: 1}, {}, function () {
                    expect(listeners.node).toHaveBeenCalled();
                    router.removeNodeListener('users', listeners.node);
                    done();
                });
            });
        });

        it('should invoke node listeners on root', function (done) {
            router.navigate('orders', {}, {}, function () {
                spyOn(listeners, 'node').and.returnValue(true);
                router.addNodeListener('', listeners.node);
                router.navigate('users', {}, {}, function () {
                    expect(listeners.node).toHaveBeenCalled();
                    router.removeNodeListener('', listeners.node);
                    done();
                });
            });
        });

        it('should invoke route listeners', function (done) {
            router.navigate('users.list', {}, {}, function () {
                spyOn(listeners, 'node').and.callThrough();
                router.addRouteListener('users', listeners.node);
                router.navigate('users', {}, {}, function () {
                    expect(listeners.node).toHaveBeenCalled();
                    router.removeRouteListener('users', listeners.node);
                    done();
                });
            });
        });

        it('should warn when trying to register a listener on a non-existing node', function () {
            spyOn(console, 'warn');
            router.addNodeListener('fake.node', listeners.node);
            expect(console.warn).toHaveBeenCalled();
            router.removeNodeListener('fake.node', listeners.node);
            // Removing twice shouldn't throw an error
            router.removeNodeListener('fake.node', listeners.node);
        });

        it('should be able to register components', function () {
            router.registerComponent('users.view', {});
            expect(Object.keys(router._cmps).length).toBe(1);

            router.registerComponent('users.list', {});
            expect(Object.keys(router._cmps).length).toBe(2);

            router.deregisterComponent('users.list');
            expect(Object.keys(router._cmps).length).toBe(1);

            router.deregisterComponent('users.view');
            expect(Object.keys(router._cmps).length).toBe(0);
        });

        it('should block navigation if a component refuses deactivation', function (done) {
            router.navigate('users.list', {}, {}, function () {
                // Cannot deactivate
                router.registerComponent('users.list', {
                    canDeactivate: function () {
                        return Promise.reject();
                    }
                });
                router.navigate('users', {}, {}, function () {
                    expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/users/list'));

                    // Can deactivate
                    router.deregisterComponent('users.list');
                    router.registerComponent('users.list', {
                        canDeactivate: function () {
                            return true;
                        }
                    });
                    router.navigate('users', {}, {}, function () {
                        expect(getPath(useHash)).toBe(getExpectedPath(useHash, '/users'));
                        done();
                    });
                });
            });
        });

        it('should warn when trying to register a component twice', function () {
            spyOn(console, 'warn');
            router.registerComponent('users.view', {});
            router.registerComponent('users.view', {});
            expect(console.warn).toHaveBeenCalled();
        });

        it('should tell if a route is active or not', function () {
            router.navigate('users.view', {id: 1});
            expect(router.isActive('users.view', {id: 1})).toBe(true);
            expect(router.isActive('users.view', {id: 2})).toBe(false);
            expect(router.isActive('users.view')).toBe(false);
            expect(router.isActive('users')).toBe(true);
            expect(router.isActive('users', {}, true)).toBe(false);

            router.navigate('section.view', {section: 'section1', id: 12});
            expect(router.isActive('section', {section: 'section1'})).toBe(true);
            expect(router.isActive('section.view', {section: 'section1', id: 12})).toBe(true);
            expect(router.isActive('section.view', {section: 'section2', id: 12})).toBe(false);
            expect(router.isActive('section.view', {section: 'section1', id: 123})).toBe(false);
            expect(router.isActive('users.view', {id: 123})).toBe(false);
        });

        it('should block navigation if a route cannot be activated', function (done) {
            spyOn(listeners, 'noop').and.callThrough();
            router.onTransitionError(listeners.noop);
            router.navigate('home', {}, {}, function () {
                router.navigate('admin', {}, {}, function () {
                    expect(router.isActive('home')).toBe(true);
                    expect(listeners.noop).toHaveBeenCalled();
                    router.offTransitionError(listeners.noop);
                    expect(router._cbs['$error'].length).toBe(0);
                    done();
                });
            });
        });

        it('should be able to cancel a transition and should invoke onTransitionCancel listeners', function (done) {
            spyOn(listeners, 'noop');
            router.onTransitionCancel(listeners.noop);
            router.canActivate('admin', function canActivate(done) { return Promise.resolve(); });
            var cancel = router.navigate('admin', {}, {}, function (err) {
                expect(err).toBe(Router5.ERR.TRANSITION_CANCELLED);
                expect(listeners.noop).toHaveBeenCalled();
                router.offTransitionCancel(listeners.noop);
                expect(router._cbs['$cancel'].length).toBe(0);
                done();
            });
            cancel();
        });

        it('should support a transition middleware', function (done) {
            spyOn(listeners, 'transition').and.callThrough();
            router.onTransition(listeners.transition);
            router.navigate('users', {}, {}, function (err, state) {
                expect(listeners.transition).toHaveBeenCalled();
                expect(err).toBe(null);
                done();
            });
        });

        it('should fail transition if middleware returns an error', function (done) {
            spyOn(listeners, 'transitionErr').and.callThrough();
            router.onTransition(listeners.transitionErr);
            router.navigate('home', {}, {}, function (err, state) {
                expect(listeners.transitionErr).toHaveBeenCalled();
                expect(err).toBe(Router5.ERR.TRANSITION_ERR);
                done();
            });
        });
    });
}
