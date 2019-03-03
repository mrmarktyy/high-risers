'use strict';

var __DEFAULT_VIEWPORT_WIDTH__  =  375;
var __DEFAULT_VIEWPORT_HEIGHT__ = 667;

function Game(options) {
  this.canvasWidth = options.canvasWidth;
  this.canvasHeight = options.canvasHeight;

  this.engine = Matter.Engine.create();
  this.world = this.engine.world;
  this.world.gravity.y = 2;
  this.world.bounds.max.x = this.canvasWidth;
  this.world.bounds.max.y = this.canvasHeight;
  this.runner = Matter.Runner.create();

  this.render = Matter.Render.create({
    canvas: options.canvas,
    engine: this.engine,
    options: {
      width: this.canvasWidth,
      height: this.canvasHeight,
      hasBounds: true,
      wireframes: false,
      background: 'transparent',
    }
  });

  this.isTouchSupported = 'ontouchstart' in document.documentElement;

  this.config = {
    game: {
      groundBase: 120,
      initialLevel: 30,
    },
    player: {
      width: 20,
      height: 30,
      velocity: 3.5,
      jumpForce: -0.021,
      options: {
        isPlayer: true, inertia: Infinity, restitution: 1, friction: 0, frictionStatic: 0, frictionAir: 0,
        collisionFilter: {group: -1},
        render: {
          sprite: {
            yOffset: 0.1
          }
        }
      }
    },
    ground: {
      width: this.canvasWidth,
      height: 10
    },
    floor: {
      width: this.canvasWidth - 30 * 2,
      height: 10,
      options: {isFloor: true, isStatic: true, restitution: 1, friction: 0,
        render: {fillStyle: '#222', strokeStyle: '#fff', lineWidth: 0}
      }
    },
    wall: {
      width: 10,
      height: 50,
      options: {isWall: true, isStatic: true, restitution: 1, friction: 0,
        render: {fillStyle: '#222', strokeStyle: '#fff', lineWidth: 0}
      }
    }
  };

  this.init = function() {
    Matter.Events.on(this.engine, 'afterUpdate', this.afterUpdate.bind(this));
    Matter.Events.on(this.engine, 'collisionStart', this.collisionStart.bind(this));

    window.addEventListener('keydown', function(event) {
      this.globalState.keys[event.keyCode] = true;
    }.bind(this));

    window.addEventListener('keyup', function(event) {
      this.globalState.keys[event.keyCode] = false;
    }.bind(this));

    if (this.isTouchSupported) {
      window.addEventListener('touchstart', this.onTouchStart.bind(this));
      window.addEventListener('touchmove', function(event) {
        event.preventDefault();
      });
      window.addEventListener('touchend', function(event) {
        event.preventDefault();
      });
    } else {
      window.addEventListener('click', this.onClick.bind(this));
    }

    $('#pause').click(this.pause.bind(this));
    $('.btn-play').click(this.play.bind(this));

    this.reset();
    this.run();
    this.renderViews();

    return this;
  };

  this.run = function() {
    Matter.Runner.run(this.runner, this.engine);
    Matter.Render.run(this.render);
  };

  this.reset = function() {
    this.globalState = {
      keys: [],
      player: {},
      levels: [],
      currentLevel: 0,
      cameraTarget: {
        x: 0,
        y: 0
      },
      cachedFloors: [],
      paused: false,
      started: false,
      views: {
        backgroundPositionY: 100,
        actions: false,
        title: true
      }
    };

    this.resetWorld();
  };

  this.resetWorld = function() {
    this.clearWorld();

    this.globalState.levels[0] = {
      floor: this.spawnGround(
        this.canvasWidth / 2,
        this.canvasHeight + this.config.ground.height / 2,
        {level: 0, minX: this.canvasWidth / 2 - this.config.floor.width / 2,
          maxX: this.canvasWidth / 2 + this.config.floor.width / 2}
      ),
      left: this.spawnWall(
        this.canvasWidth / 2 - this.config.floor.width / 2 + this.config.wall.width / 2,
        this.canvasHeight - this.config.wall.height / 2,
        {level: 0}
      ),
      right: this.spawnWall(
        this.canvasWidth / 2 + this.config.floor.width / 2 - this.config.wall.width / 2,
        this.canvasHeight - this.config.wall.height / 2,
        {level: 0}
      )
    };

    this.player = this.spawnPlayer(
      this.canvasWidth / 2,
      this.canvasHeight - this.config.player.height / 2
    );
    Object.assign(this.player, new Player(this));
    Object.assign(this.globalState.player, {
      alive: true,
      character: {
        id: 2,
        tick: 0,
        tickReset: 12,
        frame: 1,
        frameTotal: 3,
        frameInital: 1
      },
      cachedForce: {
        x: 0,
        y: 0
      },
      initialPosition: {
        x: this.player.position.x,
        y: this.player.position.y
      },
      velocityPre: {
        x: this.player.velocity.x,
        y: this.player.velocity.y
      }
    });

    var floorOffset = 0;
    for (var level = 1; level <= this.config.game.initialLevel; level++) {
      var levelBase = this.canvasHeight - level * (this.config.wall.height + this.config.floor.height);
      var floorMidX = this.canvasWidth / 2 + floorOffset;
      this.globalState.levels[level] = {
        floor: this.spawnFloor(
          floorMidX,
          levelBase + this.config.floor.height / 2,
          {
            level: level,
            minX: floorMidX - this.config.floor.width / 2, maxX: floorMidX + this.config.floor.width / 2,
            collisionFilter: {group: -1}
          }
        )
      };
      if (Math.random() > 0.45) {
        this.globalState.levels[level].left = this.spawnWall(
          floorMidX - this.config.floor.width / 2 + this.config.wall.width / 2,
          levelBase - this.config.wall.height / 2,
          {level: level}
        );
      }
      if (Math.random() > 0.45) {
        this.globalState.levels[level].right = this.spawnWall(
          floorMidX + this.config.floor.width / 2 - this.config.wall.width / 2,
          levelBase - this.config.wall.height / 2,
          {level: level}
        );
      }
    }

    Matter.Body.setVelocity(this.player, {x: this.config.player.velocity, y: 0});
  };

  this.pause = function(event) {
    event.stopPropagation();

    this.globalState.paused = true;
    this.globalState.views.actions = true;
    this.runner.enabled = false;

    this.renderViews();
  };

  this.play = function(event) {
    event.stopPropagation();

    if (this.globalState.paused) {
      this.globalState.paused = false;
      this.globalState.views.actions = false;
      this.runner.enabled = true;
    } else if (!this.globalState.player.alive) {
      this.reset();
    }

    this.renderViews();
  };

  this.climbUp = function(level) {
    this.globalState.currentLevel = level;
    this.globalState.views.backgroundPositionY -= 0.1;
    this.globalState.cachedFloors.push(level);

    this.renderViews();
  };

  this.dead = function() {
    this.globalState.player.alive = false;
    this.globalState.views.actions = true;
    this.globalState.started = false;
    this.globalState.paused = false;

    this.renderViews();
  };

  this.clearWorld = function() {
    Matter.Composite.allBodies(this.world).forEach(this.removeMatter.bind(this));
  };

  this.removeMatter = function(matter) {
    Matter.World.remove(this.world, matter);
  };

  this.spawnPlayer = function(x, y, options) {
    return this.addToWorld(Matter.Bodies.rectangle(
      x, y - this.config.game.groundBase,
      this.config.player.width, this.config.player.height,
      Object.assign({}, this.config.player.options, options)
    ));
  };

  this.spawnWall = function(x, y, options) {
    return this.addToWorld(Matter.Bodies.rectangle(
      x, y - this.config.game.groundBase,
      this.config.wall.width, this.config.wall.height,
      Object.assign({}, this.config.wall.options, options)
    ));
  };

  this.spawnFloor = function(x, y, options) {
    return this.addToWorld(Matter.Bodies.rectangle(
      x, y - this.config.game.groundBase,
      this.config.floor.width, this.config.floor.height,
      Object.assign({}, this.config.floor.options, options)
    ));
  };

  this.spawnGround = function(x, y, options) {
    return this.addToWorld(Matter.Bodies.rectangle(
      x, y - this.config.game.groundBase,
      this.canvasWidth, this.config.floor.height,
      Object.assign({}, this.config.floor.options, options)
    ));
  };

  this.addToWorld = function(matter) {
    Matter.World.add(this.world, [matter]);
    return matter;
  };

  this.onClick = function(event) {
    if (event.which !== 1) return;
    if (!this.globalState.player.alive) return;

    this.player.jump();
  };

  this.onTouchStart = function() {
    if (!this.globalState.player.alive) return;

    this.player.jump();
  };

  this.afterUpdate = function() {
    this.player
      .applyCachedForce()
      .setVerticalDirection()
      .setVerticalVelocity()
      .setSprite()
      .setCameraTarget()
      .checkClimbUp()
      .setCollisionFilterGroup();

    this.updateCamera();

    if (this.globalState.player.alive && !this.checkAlive()) {
      this.dead();
    }
  };

  this.collisionStart = function(event) {
    for (var i = 0; i < event.pairs.length; i++) {
      var m1 = event.pairs[i].bodyA.parent;
      var m2 = event.pairs[i].bodyB.parent;

      if ((m1.isPlayer && m2.isFloor) || (m1.isFloor && m2.isPlayer)) {
        this.globalState.player.isOnGround = true;
      }
    }
  };

  this.updateCamera = function() {
    Matter.Bounds.shift(this.render.bounds, {
      x: 9 * this.render.bounds.min.x / 10 + this.globalState.cameraTarget.x / 10,
      y: 9 * this.render.bounds.min.y / 10 + this.globalState.cameraTarget.y / 10
    });
  };

  this.checkAlive = function() {
    var currentFloor = this.getFloor(this.globalState.currentLevel);
    var validMinX = currentFloor.minX - this.config.player.width / 2;
    var validMaxX = currentFloor.maxX + this.config.player.width / 2;

    return this.player.position.x >= validMinX && this.player.position.x <= validMaxX;
  };

  this.renderViews = function() {
    $('#level').text(this.globalState.currentLevel);
    if (this.globalState.views.title) {
      $('#titleImg').removeClass('out');
    } else {
      $('#titleImg').addClass('out');
    }
    if (this.globalState.views.actions) {
      $('#actions').removeClass('out');
    } else {
      $('#actions').addClass('out');
    }
    if (this.globalState.paused || !this.globalState.started) {
      $('#pause').addClass('out');
    } else {
      $('#pause').removeClass('out');
    }
    $('#main').css('background-position-y', this.globalState.views.backgroundPositionY + '%');
  };

  this.getFloor = function(level) {
    if (!this.globalState.levels[level]) return;

    return this.globalState.levels[level].floor;
  };
}

function Player(game) {
  this.game = game;
  this.globalState = game.globalState;
  this.state = this.globalState.player;

  this.applyCachedForce = function() {
    if (this.state.cachedForce.x !== 0 || this.state.cachedForce.y !== 0) {
      Matter.Body.applyForce(this, this.position, this.state.cachedForce);
      this.state.cachedForce.x = 0;
      this.state.cachedForce.y = 0;
    }
    return this;
  };

  this.setVerticalDirection = function() {
    if (Math.abs(this.velocity.y) < 0.6) {
      this.state.direction = 0;
    } else {
      this.state.direction = this.velocity.y > 0 ? 1 : -1;
    }
    return this;
  };

  this.setVerticalVelocity = function() {
    if (this.state.isOnGround) {
      Matter.Body.setVelocity(this, {x: this.velocity.x, y: 0});
    }
    return this;
  };

  this.setSprite = function() {
    if (Math.abs(this.state.velocityPre.x - this.velocity.x) > 1) {
      this.state.character.tick = 0;
      this.state.character.frame = this.state.character.frameInital;
    } else {
      this.state.character.tick++;
      if (this.state.character.tick % this.state.character.tickReset === 0) {
        this.state.character.frame++;
        if (this.state.character.frame > this.state.character.frameTotal) {
          this.state.character.frame = this.state.character.frameInital;
        }
      }
    }

    this.render.sprite.texture = './images/character/' +
      this.state.character.id +
      (this.velocity.x > 0 ? 'r' : 'l') +
      this.state.character.frame + '.png';

    this.state.velocityPre = this.velocity;
    return this;
  };

  this.setCameraTarget = function() {
    if (this.state.alive &&
      ~~this.position.y - this.state.initialPosition.y < this.globalState.cameraTarget.y) {
      this.globalState.cameraTarget.y = ~~this.position.y - this.state.initialPosition.y;
    }
    return this;
  };

  this.checkClimbUp = function() {
    var nextFloor = this.game.getFloor(this.globalState.currentLevel + 1);
    if (this.position.y < nextFloor.position.y) {
      this.game.climbUp(nextFloor.level);
    }
    return this;
  };

  this.setCollisionFilterGroup = function() {
    if (this.state.direction === 1 && this.globalState.cachedFloors.length) {
      this.globalState.cachedFloors.forEach(function(level) {
        this.game.getFloor(level).collisionFilter.group = 0;
      }.bind(this));
      this.globalState.cachedFloors = [];
    }
    return this;
  };

  this.jump = function() {
    if (!this.globalState.started) {
      this.globalState.started = true;
      this.globalState.views.title = false;
    }

    // console.log(this.state.direction);
    if (this.state.direction === -1) {
      this.state.cachedForce.y = -0.01;
      console.log('j1');
    } else if (this.state.direction === 1) {
      this.state.cachedForce.y = -0.02;
      console.log('j2');
    } else {
      this.state.cachedForce.y = this.game.config.player.jumpForce;
    }
    this.state.isOnGround = false;

    this.game.renderViews();
  };
}

$(function() {
  var canvasWidth, canvasHeight;
  if (window.innerWidth > 1000) {
    canvasWidth = __DEFAULT_VIEWPORT_WIDTH__;
    canvasHeight = __DEFAULT_VIEWPORT_HEIGHT__;
  } else {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
  }

  $('#main').css({
    width: canvasWidth,
    height: canvasHeight
  });

  new Game({
    canvas: document.getElementById('canvas'),
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight
  }).init();
});
