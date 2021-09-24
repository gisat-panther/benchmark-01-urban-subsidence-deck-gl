import {
    Ion,
    Viewer,
    Color,
    PointPrimitiveCollection,
    requestAnimationFrame,
    Cartesian3,
    Clock,
    ClockViewModel,
    AnimationViewModel,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./css/main.css";
import chroma from "chroma-js";
import arrayShuffle from 'array-shuffle';
import * as dat from 'dat.gui';

// ---- GUI definition - start
const gui = new dat.GUI();
const settings = {
    animationType: "real data"
}
let guiAnimType = gui.add(settings, 'animationType', ['real data', 'random data 10 000', 'random data 100 000']).name('Animation type').listen();
// ---- GUI definition - end

Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4NGNhMzk5NC1kYjk5LTQ5ZDEtOTM5Yy0zYmUyYWEwMjY5MmQiLCJpZCI6NTgyNjksImlhdCI6MTYyMzA1NTMyMX0.7jidfR2a2M5t8KsvDho5TJcBLBZl04UBj3jdeAB1otY";

const URLS = ["https://ptr.gisat.cz/ftpstorage/applications/3dflus/test_data/interferometry/los/32.json"];


let animation_type = settings.animationType;
let random_animated_points_count = 100000;

const ANIMATED_POINTS_COUNT = 1000;
const FRAME_MIN_TIME = 0.5;

let clock = new Clock({});
let clockViewModel = new ClockViewModel(clock);
let viewModel = new AnimationViewModel(clockViewModel);

let lastFrameTime = clock.currentTime.secondsOfDay;
let frameCount = 1000;
let currentFrame = 0;
let timelineDates = [];
let animatedPointsData = []

const setAnimationType = (value) => {
    animation_type = value;
    if (value === "random data 10 000") {
        random_animated_points_count = 10000
    } else if (value === "random data 100 000") {
        random_animated_points_count = 100000
    }

}

let colorScale = chroma
    .scale(["#fda34b", "#ff7882", "#c8699e", "#7046aa", "#0c1db8", "#2eaaac"])
    .domain([-30, 10]);

let viewer = new Viewer("cesiumContainer");
let scene = viewer.scene;

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const loadAnimatedData = (entireDataset) => {
    let idList = entireDataset.map((item) => item.id);
    let idListShorten = arrayShuffle(idList).slice(0, ANIMATED_POINTS_COUNT);

    let promisedData = [];
    idListShorten.forEach((id) => {
        const url = `https://ptr.gisat.cz/ftpstorage/applications/emsn091Manila/interferometry/los/32/${id}.json`;
        // const url = `../../../data/interferometry_anim_data/los/32/${id}.json`;
        promisedData.push(
            new Promise((resolve) => resolve(
                fetch(url).then((response) => {
                    return response.json();
                })
            ))
        );
    });
    return Promise.all(promisedData).then((values) => values);
}

const createTimeArrays = (animatedData) => {
    animatedData.forEach((item, index) => {
        let timelineValues = [];
        Object.entries(item.properties).forEach(([key, value]) => {
            if (key.startsWith("d_")) {
                timelineValues.push(value == null ? 0 : value);
                if (index === 0) timelineDates.push(key);
            }
        });
        if (index === 0) frameCount = timelineValues.length;
        animatedData[index].d_timeline = timelineValues;
        animatedData[index].modified_height = item.properties.h_cop30m + 10000;
        animatedData[index].coordinate_update = timelineValues[0];
    });
    return animatedData
};

const animate = () => {
    clock.shouldAnimate = true;
    clock.tick();

    if (clock.currentTime.secondsOfDay - lastFrameTime < FRAME_MIN_TIME) {
        requestAnimationFrame(animate);
        return;
    }
    lastFrameTime = clock.currentTime.secondsOfDay;

    if (currentFrame < frameCount) currentFrame++;
    else currentFrame = 0;

    viewer.dataSources.removeAll();
    scene.primitives.removeAll();

    let points = scene.primitives.add(new PointPrimitiveCollection());

    animatedPointsData.forEach((d, index) => {
        if (currentFrame === 0) {
            animatedPointsData[index].modified_height = d.properties.h_cop30m + 10000;
        }
        if (animation_type === "real data") {
            animatedPointsData[index].modified_height =
                d.modified_height + d.d_timeline[currentFrame] * 10;
        } else {
            animatedPointsData[index].modified_height =
                d.modified_height + getRandomInt(-1000, 1000);
        }
        const coord = d.geometry.coordinates;
        const color = colorScale(d.properties.vel_avg);
        points.add({
            position: Cartesian3.fromDegrees(coord[0], coord[1], d.modified_height),
            color: Color.fromCssColorString(color.name()),
            pixelSize: animation_type !== "real data" ? 4 : 6,
        });
    })
    requestAnimationFrame(animate)
};

const displayAnimation = () => {
    let promisedData = [];
    URLS.forEach((url) =>
        promisedData.push(
            new Promise((resolve) =>
                resolve(
                    fetch(url).then((response) => {
                        return response.json();
                    })
                )
            )
        )
    );

    if (animation_type === "real data") {
        Promise.all(promisedData)
            .then((values) => {
                    let data = loadAnimatedData(values.flat())
                    data.then(data => {
                            animatedPointsData = createTimeArrays(data)
                            animate()
                        }
                    )
                }
            )
    } else {
        Promise.all(promisedData).then(values => {
            let data = arrayShuffle(values.flat()).slice(0, random_animated_points_count);
            console.log("Data length: ", data.length);
            data.forEach((value, index) => {
                data[index].modified_height = value.properties.h_cop30m + 10000
            })
            animatedPointsData = data
            animate()
        })
    }
}

displayAnimation()

guiAnimType.onChange(value => {
    scene.primitives.removeAll();
    setAnimationType(value)
    displayAnimation()
})

let camera = viewer.camera;
camera.setView({
    destination: Cartesian3.fromDegrees(120.81321, 14.7569, 150000.0)
})

