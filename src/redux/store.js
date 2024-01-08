import {configureStore, createListenerMiddleware} from '@reduxjs/toolkit';
import WsController, {
  onSendingMessage,
  onWsClosed,
} from './Slices/WsController';
import UserStateController, {
  onLogin,
  displayLoginFaildAlert,
  displayLoginRequestingCircle,
  onLoadClasses,
  onLookUpClass,
  onLogout,
} from './Slices/UserStateController';
import {onReceivedMessage} from './Slices/WsController';
import StorageUtil from '../storage';
import ReconnectingWebSocket from 'reconnecting-websocket';
import naviagte from '../mods/RootNavigation';
import logger from 'redux-logger';
import {Image} from 'react-native';
import {DB_Config} from '../sqliteConfig';
// import { initDB, insertDataToTable } from '../sqlite';

const WsListener = createListenerMiddleware();

WsListener.startListening({
  actionCreator: onReceivedMessage,
  effect: (action, listenerApi) => {
    switch (action.payload.command) {
      case 'message':
        // initDB(action.payload.data.user);
        var storeMessage = {
          text: action.payload.data.body.text,
          sent: false,
        };
        var data = {
          MESSAGE: JSON.stringify(storeMessage),
          TIME: Date.now(),
        };
        // insertDataToTable(
        //   DB_Config.tables.MsgDataTable,
        //   data,
        //   (success, err) => {
        //     if (success) {
        //       console.log('Message inserted successfully');
        //     } else {
        //       console.log('Error inserting message:', err);
        //     }
        //   },
        // );

        break;
      case 'login':
        setTimeout(() => {
          listenerApi.dispatch(displayLoginRequestingCircle(false));
          if (action.payload.status === 'success') {
            //解除loading状态
            if (listenerApi.getState().UserStateController.IsLogined) {
            } else {
              listenerApi.dispatch(onLogin(action.payload.content));
              naviagte.reset({
                index: 0,
                routes: [
                  {
                    name: 'IndexPage',
                  },
                ],
              });
              StorageUtil.setItem('LoginState', 'logined');
            }
            listenerApi.dispatch(
              onSendingMessage({
                command: 'getTeachingClasses',
                content:{},
              }),
            );
            //请求班级信息
            // Image.prefetch(action.payload.img); //缓存图片
          } else {
            listenerApi.dispatch(displayLoginFaildAlert(true));
          }
        }, 1000);
        break;
      case 'getTeachingClasses':
        if (action.payload.teachingClass == null) {
          data = [];
        } else {
          data = JSON.parse(action.payload.teachingClass);
        }
        listenerApi.dispatch(onLoadClasses(data));
        data.forEach(element => {
          console.log(element);
          listenerApi.dispatch(
            onSendingMessage({
              command: 'getOnlineUser',
              content: {
                userId: Number(element),
              },
            }),
          );
        });
        break;
      case 'getOnlineUser':
        if (action.payload.content.userId) {
          let list = listenerApi.getState().UserStateController.ClassesListData;
          if (!list.some(element => element.userId === action.payload.content.userId)) {
            listenerApi.dispatch(onLookUpClass(action.payload.content));
          }
        }
        break;
    }
  },
});

WsListener.startListening({
  actionCreator: onSendingMessage,
  effect: (action, listenerApi) => {
    listenerApi.dispatch((dispatch, getstate, api) => {
      api.send(JSON.stringify(action.payload));
      console.log('正在发送:' + JSON.stringify(action.payload));
    });
  },
});

WsListener.startListening({
  actionCreator: onLogin,
  effect: (action, listenerApi) => {},
});

WsListener.startListening({
  actionCreator: onLogout,
  effect: (action, listenerApi) => {
    listenerApi.dispatch((dispatch, getstate, api) => {
      StorageUtil.setItem('LoginState', 'unlogined');
      api.close();
      console.log('因用户登出，已执行断开重连');
      api.reconnect();
    });
  },
});

export default configureStore({
  reducer: {
    WsController: WsController,
    UserStateController: UserStateController,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      thunk: {
        extraArgument: new ReconnectingWebSocket('ws://106.53.58.190:8900/ws'),
      },
    })
      .prepend(WsListener.middleware)
      .concat(logger),
});
